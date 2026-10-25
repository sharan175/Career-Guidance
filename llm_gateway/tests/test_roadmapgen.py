"""roadmapgen tests — provider faked, no network."""
import json

import pytest

from careermind_llm.roadmapgen import (
    _parse_payload,
    build_roadmap,
    generate_roadmap,
    slugify,
)


class FakeClient:
    def __init__(self, reply):
        self.reply = reply
        self.calls = []

    def complete(self, messages, temperature=0.7, max_tokens=1024):
        self.calls.append(
            {"messages": messages, "temperature": temperature, "max_tokens": max_tokens}
        )
        return self.reply


PAYLOAD = {
    "title": "Data Scientist",
    "description": "Beginner to advanced path into data science.",
    "sections": [
        {
            "heading": "Foundations",
            "topics": [
                {
                    "label": "Python Basics",
                    "description": "Learn **Python** fundamentals.",
                    "subtopics": ["Variables", "Control flow", "Functions"],
                    "resources": [
                        {
                            "title": "Python Tutorial",
                            "url": "https://docs.python.org/3/tutorial/",
                            "type": "official",
                            "free": True,
                        },
                        {
                            "title": "Broken",
                            "url": "not-a-url",
                            "type": "video",
                            "free": False,
                        },
                        {
                            "title": "Odd type",
                            "url": "https://example.com/x",
                            "type": "podcast",
                            "free": "yes",
                        },
                    ],
                },
                {
                    "label": "Math for ML",
                    "description": "Linear algebra and probability.",
                    "resources": [],
                },
            ],
        },
        {
            "heading": "Core Skills",
            "topics": [
                {"label": "Data Wrangling", "description": "pandas."},  # no resources key
            ],
        },
    ],
}


def test_slugify_matches_frontend_career_slug():
    # Parity with frontend/src/lib/roadmap/slug.ts careerSlug().
    assert slugify("Data Scientist") == "data-scientist"
    assert slugify("AR/VR Developer") == "ar-vr-developer"
    assert slugify("  Tech Product Manager ") == "tech-product-manager"
    assert slugify("C++ Engineer") == "c-engineer"


def test_generate_uses_client_and_builds_full_schema():
    client = FakeClient(json.dumps(PAYLOAD))
    roadmap = generate_roadmap("Data Scientist", client=client)

    assert roadmap["slug"] == "data-scientist"
    assert roadmap["title"] == "Data Scientist"
    assert roadmap["version"] == 1
    assert roadmap["edges"] == []  # connectors are lane-derived at render time

    kinds = {n["kind"] for n in roadmap["nodes"]}
    assert kinds == {"section", "topic"}
    # subtopics are also kind:"topic" — spine topics are the ones without parentId
    spine_topics = [n for n in roadmap["nodes"] if n["kind"] == "topic" and "parentId" not in n]
    assert len(spine_topics) == 3

    # ids unique, parentIds resolvable
    ids = [n["id"] for n in roadmap["nodes"]]
    assert len(ids) == len(set(ids))
    for node in roadmap["nodes"]:
        if "parentId" in node:
            assert node["parentId"] in ids

    # subtopics alternate left/right and are secondary
    subtopics = [n for n in roadmap["nodes"] if "parentId" in n]
    assert [s["lane"] for s in subtopics] == ["left", "right", "left"]
    assert all(s["variant"] == "secondary" for s in subtopics)

    # the prompt carries the career name
    call = client.calls[0]
    assert "Data Scientist" in call["messages"][1]["content"]
    assert call["messages"][0]["role"] == "system"


def test_resources_are_sanitised():
    client = FakeClient(json.dumps(PAYLOAD))
    roadmap = generate_roadmap("Data Scientist", client=client)
    topic = next(n for n in roadmap["nodes"] if n["label"] == "Python Basics")

    # invalid URL dropped, unknown type coerced to "article", free coerced
    assert len(topic["resources"]) == 2
    assert topic["resources"][0]["type"] == "official"
    assert topic["resources"][1]["type"] == "article"
    assert topic["resources"][1]["free"] is True

    # markdown stripped from descriptions
    assert topic["description"] == "Learn Python fundamentals."


def test_parse_payload_strips_fences_and_surrounding_prose():
    raw = 'Sure! Here is the roadmap:\n```json\n' + json.dumps(PAYLOAD) + "\n```\nHope that helps."
    assert _parse_payload(raw)["title"] == "Data Scientist"


def test_parse_payload_salvages_truncated_json():
    # Cut mid-way through the LAST topic: earlier sections must survive.
    full = json.dumps(PAYLOAD)
    truncated = full[: full.rfind('"Linear algebra')]
    payload = _parse_payload(truncated)
    labels = [t["label"] for s in payload["sections"] for t in s["topics"]]
    assert "Python Basics" in labels
    assert "Data Wrangling" not in labels  # incomplete tail dropped


def test_parse_payload_rejects_garbage():
    with pytest.raises(ValueError):
        _parse_payload("no json here")
    with pytest.raises(ValueError):
        _parse_payload("[1, 2, 3]")  # array, not object


def test_build_roadmap_rejects_empty_payloads():
    with pytest.raises(ValueError):
        build_roadmap("X", {"sections": []})
    with pytest.raises(ValueError):
        build_roadmap("X", {"sections": [{"heading": "A", "topics": []}]})
    with pytest.raises(ValueError):
        build_roadmap("", {})


def test_duplicate_labels_get_unique_ids():
    payload = {
        "sections": [
            {
                "heading": "A",
                "topics": [
                    {"label": "React", "description": "x"},
                    {"label": "React", "description": "y"},
                ],
            }
        ]
    }
    roadmap = build_roadmap("Web Dev", payload)
    ids = [n["id"] for n in roadmap["nodes"]]
    assert len(ids) == len(set(ids))
    assert "react" in ids and "react-2" in ids


def test_caps_are_applied():
    payload = {
        "sections": [
            {
                "heading": f"Section {i}",
                "topics": [
                    {"label": f"Topic {i}-{j}", "subtopics": [f"sub {j}-{k}" for k in range(9)]}
                    for j in range(12)
                ],
            }
            for i in range(12)
        ]
    }
    roadmap = build_roadmap("Big Career", payload)
    sections = [n for n in roadmap["nodes"] if n["kind"] == "section"]
    topics = [n for n in roadmap["nodes"] if n["kind"] == "topic" and "parentId" not in n]
    subs = [n for n in roadmap["nodes"] if "parentId" in n]
    assert len(sections) == 8  # MAX_SECTIONS
    assert len(topics) == 8 * 10  # MAX_TOPICS_PER_SECTION per section
    assert len(subs) == 8 * 10 * 5  # MAX_SUBTOPICS_PER_TOPIC per topic


def test_generate_roadmap_requires_career():
    with pytest.raises(ValueError):
        generate_roadmap("   ", client=FakeClient("{}"))
