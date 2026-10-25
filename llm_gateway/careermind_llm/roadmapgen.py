"""LLM-generated career roadmaps (roadmap.sh-style).

The model is asked for a SIMPLIFIED structure (sections → topics → subtopics +
resources). Converting to the full roadmap schema here — rather than trusting
the model to emit node ids, lanes and edges — keeps ids unique, `parentId`
referential, and lanes consistent by construction, so the output always passes
the frontend's zod `roadmapSchema`.

Resource links come straight from the model and are NOT verified to resolve;
they are only shape-validated (http(s) URL, known type enum). The frontend
labels them as AI-suggested for the same reason.
"""
import json
import os
import re
from urllib.parse import urlparse

# Resource vocabulary shared with the frontend `ResourceType` enum.
RESOURCE_TYPES = {"course", "official", "video", "article", "book", "practice"}

# Hard caps: an over-eager model must not be able to emit an unusable roadmap.
MAX_SECTIONS = 8
MAX_TOPICS_PER_SECTION = 10
MAX_SUBTOPICS_PER_TOPIC = 5
MAX_RESOURCES_PER_TOPIC = 6
MAX_LABEL_CHARS = 100
MAX_DESCRIPTION_CHARS = 700

_SYSTEM = (
    "You are a career roadmap expert. You produce roadmap.sh-style expert "
    "learning paths from beginner to advanced for a requested career.\n"
    "Respond with ONLY a JSON object — no prose, no code fences. It must look "
    "exactly like this:\n"
    '{"title": str, "description": str, "sections": [ {"heading": str, '
    '"topics": [ {"label": str, "description": str, "subtopics": [str, ...], '
    '"resources": [ {"title": str, "url": str, '
    '"type": "course"|"official"|"video"|"article"|"book"|"practice", '
    '"free": bool} ] } ] } ]}\n'
    "Rules: 3-6 sections ordered beginner → advanced; 2-6 topics per section "
    "with a 1-3 sentence description each; up to 3 short subtopic labels per "
    "topic; 1-4 REAL learning resources per topic pointing at genuine, "
    "well-known pages (official docs, recognised courses, established "
    "articles/videos) — never invented or guessed URLs. Set free=true only "
    "for resources that cost nothing."
)


def slugify(value: str) -> str:
    """Must stay byte-identical to the frontend's `careerSlug()` in
    `src/lib/roadmap/slug.ts` (lowercase, non-alphanumeric runs → '-', trimmed)."""
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", value.strip().lower())).strip("-")


def generate_roadmap(career: str, context: str | None = None, client=None) -> dict:
    """Return a full roadmap dict (frontend schema) for `career`.

    `context` is an optional short personalisation string (programme, skills).
    Raises ValueError when the model output cannot be turned into a usable
    roadmap; callers map that to 502 (same convention as quiz generation).
    """
    career = (career or "").strip()
    if not career:
        raise ValueError("career is required")
    if client is None:
        client = _gemini_client()

    user = f'Create an expert career roadmap for "{career}", beginner to advanced.'
    if context and context.strip():
        user += f"\nLearner context (tailor depth and emphasis, do not mention it explicitly): {context.strip()}"
    user += (
        "\nInclude a realistic set of projects/practice embedded in topic "
        "descriptions where natural. Prefer free, high-quality resources."
    )

    raw = client.complete(
        [{"role": "system", "content": _SYSTEM}, {"role": "user", "content": user}],
        temperature=0.4,
        max_tokens=8000,
    )
    payload = _parse_payload(raw)
    return build_roadmap(career, payload)


def _gemini_client():
    """Roadmap generation always uses the Gemini adapter (the user-facing
    feature is 'generate with Google Gemini'), while LLM_API_KEY /
    LLM_FALLBACK_MODELS keep their usual meaning.

    LLM_MODEL may name a different provider's model (e.g. gpt-4o-mini); only
    reuse it when it actually names a Gemini model, else fall back to a Gemini
    default. ROADMAP_LLM_MODEL overrides both.
    """
    from .client import get_client

    model = (os.getenv("ROADMAP_LLM_MODEL") or "").strip()
    if not model:
        env_model = (os.getenv("LLM_MODEL") or "").strip()
        model = env_model if env_model.startswith("gemini-") else "gemini-3.5-flash"
    return get_client("gemini", model=model)


# --------------------------------------------------------------------------- #
# Parsing (mirrors quizgen's defensive posture)
# --------------------------------------------------------------------------- #


def _parse_payload(raw: str) -> dict:
    text = (raw or "").strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("LLM did not return a JSON object for the roadmap")
    fragment = text[start : end + 1]

    data = _try_parse_or_salvage(fragment)
    if data is None:
        raise ValueError("LLM returned invalid roadmap JSON")
    if not isinstance(data, dict):
        raise ValueError("LLM roadmap output must be a JSON object")
    return data


def _try_parse_or_salvage(fragment: str) -> dict | None:
    """Parse `fragment`, salvaging output truncated mid-JSON.

    Thinking-era models can exhaust the output budget partway through a long
    roadmap. Instead of discarding the whole generation, close the structures
    that were still open at the cut point so every COMPLETE section/topic
    survives (partial tail elements are dropped).
    """
    try:
        return json.loads(fragment)
    except json.JSONDecodeError:
        pass

    # Snapshot the open-structure stack after each complete }/] so we can try
    # closing the JSON at the most recent safe point, innermost first.
    stack: list[str] = []
    snapshots: list[tuple[int, list[str]]] = []
    in_str = esc = False
    for i, ch in enumerate(fragment):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "{[":
            stack.append(ch)
        elif ch in "}]":
            if not stack:
                return None  # unbalanced closers — not truncation, give up
            stack.pop()
            snapshots.append((i + 1, list(stack)))

    for cut, openers in reversed(snapshots):
        closers = "".join("}" if opener == "{" else "]" for opener in reversed(openers))
        try:
            data = json.loads(fragment[:cut] + closers)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data
    return None


# --------------------------------------------------------------------------- #
# Normalisation: simplified payload → full frontend roadmap schema
# --------------------------------------------------------------------------- #


def build_roadmap(career: str, payload: dict) -> dict:
    """Deterministically convert the (validated-JSON) payload.

    Guarantees: unique node ids, resolvable parentIds, valid lanes/types, and
    at least one topic — i.e. everything `roadmapSchema` superRefine checks.
    Edges stay empty: connectors are derived from lane layout at render time
    (same decision as the seed roadmaps).
    """
    title = _clean(str(payload.get("title") or ""), 120) or career
    description = _clean(str(payload.get("description") or ""), 400) or (
        f"An AI-generated beginner-to-advanced roadmap for {career}."
    )

    nodes: list[dict] = []
    used_ids: set[str] = set()
    topic_count = 0

    sections = payload.get("sections")
    if not isinstance(sections, list) or not sections:
        raise ValueError("LLM roadmap payload has no sections")

    for section in sections[:MAX_SECTIONS]:
        if not isinstance(section, dict):
            continue
        heading = _clean(str(section.get("heading") or ""), 80)
        if not heading:
            continue
        section_id = _unique_id(slugify(heading) or "section", used_ids)
        nodes.append({"id": section_id, "kind": "section", "label": heading, "lane": "spine"})

        topics = section.get("topics")
        if not isinstance(topics, list):
            continue
        for topic in topics[:MAX_TOPICS_PER_SECTION]:
            if not isinstance(topic, dict):
                continue
            label = _clean(str(topic.get("label") or ""), MAX_LABEL_CHARS)
            if not label:
                continue
            topic_id = _unique_id(slugify(label) or "topic", used_ids)
            node: dict = {
                "id": topic_id,
                "kind": "topic",
                "lane": "spine",
                "label": label,
            }
            description_text = _clean(str(topic.get("description") or ""), MAX_DESCRIPTION_CHARS)
            if description_text:
                node["description"] = description_text
            resources = _resources(topic.get("resources"))
            if resources:
                node["resources"] = resources
            nodes.append(node)
            topic_count += 1

            subtopics = topic.get("subtopics")
            if isinstance(subtopics, list):
                for index, sub in enumerate(subtopics[:MAX_SUBTOPICS_PER_TOPIC]):
                    sub_label = _clean(str(sub), 80)
                    if not sub_label:
                        continue
                    nodes.append(
                        {
                            "id": _unique_id(f"{topic_id}-sub-{index + 1}", used_ids),
                            "kind": "topic",
                            "lane": "left" if index % 2 == 0 else "right",
                            "variant": "secondary",
                            "parentId": topic_id,
                            "label": sub_label,
                        }
                    )

    if topic_count == 0:
        raise ValueError("LLM roadmap payload contains no usable topics")

    return {
        "slug": slugify(career),
        "title": title,
        "description": description,
        "nodes": nodes,
        "edges": [],  # connectors are derived from lanes at render time
        "version": 1,
    }


def _resources(raw: object) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for entry in raw[:MAX_RESOURCES_PER_TOPIC]:
        if not isinstance(entry, dict):
            continue
        url = str(entry.get("url") or "").strip()
        if not _valid_url(url):
            continue  # drop rather than ship a link the schema would reject
        out.append(
            {
                "title": _clean(str(entry.get("title") or ""), 120) or url,
                "url": url,
                "type": str(entry.get("type") or "").strip().lower()
                if str(entry.get("type") or "").strip().lower() in RESOURCE_TYPES
                else "article",
                "free": _coerce_free(entry.get("free")),
            }
        )
    return out


def _coerce_free(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "yes", "free", "1"}
    return True  # most resources we point at are free; models default to it


def _valid_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _clean(text: str, max_chars: int) -> str:
    """Strip model markdown (bold/code fences) and clamp length on a word boundary."""
    text = text.replace("```", "").strip()
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars].rsplit(" ", 1)[0].rstrip(",.;:")
    return cut or text[:max_chars]


def _unique_id(base: str, used: set[str]) -> str:
    candidate, suffix = base, 2
    while candidate in used:
        candidate = f"{base}-{suffix}"
        suffix += 1
    used.add(candidate)
    return candidate
