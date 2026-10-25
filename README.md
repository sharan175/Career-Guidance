# CAREERMIND

A behaviour-aware adaptive career guidance platform implementing the architecture
described in the CAREERMIND research paper: a six-component system (two supporting
layers + four core modules) that integrates hybrid course/career recommendation,
reinforcement-learning-based adaptive feedback, and the novel
**Focus Efficiency Score (FES)** into a single coherent platform.

## About the Project

CAREERMIND targets engineering undergraduates with a closed feedback loop:
behavioural interaction data is converted into a **Focus Efficiency Score (FES)** —
a composite of five sub-metrics (task completion, session consistency,
distraction-free engagement, quiz persistence, resource depth) — which then drives
hybrid career recommendations, adapts a DQN-based feedback policy, and feeds the
career path prediction ensemble.

The project has two AI parts, deliberately decoupled:

- **Part A — External LLM API (`llm_gateway/`):** a provider-agnostic LLM client
  (OpenAI / Anthropic / Gemini) powering conversational career guidance,
  plain-language recommendation explanations (NFR07), and quiz generation.
- **Part B — Own model training (`ml/`):** the paper's models trained from scratch:
  the FES weight calibration (Eq. 2), the 3-stage hybrid cascade recommender
  (knowledge graph → FES-weighted CF → Factorisation Machine), the DQN agent
  (17-dim state, 8 actions, Eq. 3 reward), and the career prediction ensemble
  (Random Forest + Gradient Boosting + MLP with a logistic-regression meta-learner).

## Module Map

| Module | Purpose | Paper section |
|---|---|---|
| `frontend/` | Next.js (TypeScript + Tailwind) UI + behavioural event tracking SDK (User Interaction Layer) | Sec. V |
| `backend/` | Django REST Framework APIs; loads trained model artifacts; serves both Part A and Part B | Sec. V, VI |
| `ml/` | **Part B** — own model training: FES engine, cascade recommender, DQN agent, career ensemble | Sec. V-A–V-D |
| `llm_gateway/` | **Part A** — external LLM API integration: chat, explanations, quiz generation | NFR07 |
| `data/` | OULAD downloader + schema mapper, synthetic student simulator (latent parameters, OULAD-calibrated), career knowledge-graph seed, Mongo seeder | Sec. VIII |
| `evaluation/` | Pilot-study benchmarks, metrics (P@k / R@k / nDCG@k), sensitivity analysis | Sec. VII–VIII |
| `infra/` | docker-compose (web, frontend, mongo, redis, celery) | Sec. VI |
| `docs/` | Architecture description (Fig. 1) | Sec. V |

## Tech Stack

- **Backend:** Python 3.10+ · Django 5 · Django REST Framework · SimpleJWT · MongoEngine · Celery · Redis
- **Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · TanStack Query · axios
- **Database:** MongoDB (flexible multi-dimensional student profiles)
- **ML (Part B):** PyTorch (DQN, FM) · scikit-learn (ensemble) · scipy/pandas (FES) · networkx (knowledge graph) · gymnasium (RL environment)

## Project Structure

```
careermind/
├── frontend/      # Next.js UI + behavioural tracking SDK
├── backend/       # Django REST API (8 apps under apps/)
├── ml/            # Part B: careermind_ml training package + configs + tests
├── llm_gateway/   # Part A: careermind_llm package (provider adapters)
├── data/          # OULAD downloader + schema mapper, student simulator, careers seed, Mongo seeder
├── evaluation/    # metrics, baselines, pilot study runner, sensitivity analysis
├── infra/         # docker-compose.yml
├── docs/          # architecture.md (Fig. 1)
├── Makefile       # common commands
└── .env.example   # environment template
```

## Prerequisites

- **Python 3.10+** (3.11/3.12 recommended) with `pip` and `venv`
- **Node.js 20+** with npm
- **MongoDB 7** — local install or Docker
- **Redis 7** — local install or Docker
- **Docker + Docker Compose** (only for the one-command option)
- An **LLM API key** (OpenAI, Anthropic, or Gemini) for Part A features

## How to Run

### Option A — One command with Docker Compose

```bash
cp .env.example .env        # fill in secrets (LLM API key, Django secret)
make dev                    # mongo + redis + backend(:8000) + celery + frontend(:3000)

# in a second terminal — load data into the (fresh) compose Mongo
docker compose -f infra/docker-compose.yml run --rm web python /app/data/seeds/seed_mongo.py
```

Then open http://localhost:3000 (frontend) and http://localhost:8000/api/v1/ (API).
The images bake in `careermind_ml`/`careermind_llm` (editable) and the trained
artifacts under `ml/artifacts/` (committed to the repo — see
[Reproducibility](#reproducibility)); retrain with `make train-fes train-fm
train-dqn train-ensemble` only if you change the models, then rebuild.

### Option B — Run locally, module by module

**1. Start MongoDB and Redis** (skip if already running):

```bash
docker run -d -p 27017:27017 mongo:7
docker run -d -p 6379:6379 redis:7-alpine
```

**2. Configure environment:**

```bash
cp .env.example .env
```

**3. Install and start the backend** (http://localhost:8000):

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && python manage.py runserver
```

**4. Load the data foundation into MongoDB** (Phase 1):

```bash
# OULAD: official URLs first, falls back to a verified GitHub mirror
# (all 7 CSVs match the published row counts)
python data/oulad/download.py --out data/oulad/raw/

# Map OULAD tables -> CAREERMIND schema (profiles, sessions, events, resources)
python data/oulad/map_oulad.py --limit-students 200 --with-events

# Seed the career knowledge graph + 200 synthetic students
# (latent-parameter simulator, calibrated to OULAD marginals)
python data/seeds/seed_mongo.py --students 200
# -> 20 skills, 18 career pathways, 200 OULAD + 200 synthetic profiles
```

**5. Install and start the frontend** (http://localhost:3000):

```bash
cd frontend
npm install
npm run dev
```

**6. (Optional) Install the ML packages for development:**

```bash
pip install -e "ml[dev]"        # Part B — pulls torch, sklearn, gymnasium
pip install -e "llm_gateway[dev]"  # Part A — provider SDKs optional
```

### What you should see

- **Frontend:** every page is live — landing, login, dashboard (FES ring +
  14-day trend + sub-metrics), career prediction distribution, recommendations
  (accept/reject + LLM "Why this?" explanations), skill quizzes (seeded demos +
  AI generation), and the guidance chat (friendly degradation without
  `LLM_API_KEY`). The behavioural tracking SDK is wired into every page
  (session lifecycle, page dwell, quiz attempts, recommendation decisions),
  so live sessions carry real events into the FES pipeline.
- **Backend:** every endpoint implemented (no 501 stubs remain) — FES,
  recommendations, career prediction, RL feedback, quiz/courses, collector, and
  the LLM proxy; JWT required where noted (FES endpoints serve only the
  caller's own history — the cross-student `?student=` shortcut is gone).
  `POST /api/v1/collector/sessions/{id}/end` accepts a final event batch with
  the session close so nothing tracked on the last page is lost. LLM endpoints
  return 503 until
  `LLM_API_KEY` is set (see `.env.example`; the backend loads the repo-root
  `.env` automatically).
- **MongoDB** (after the data-foundation steps): 18 career pathways + 20 skills,
  200 OULAD + 200 synthetic student profiles (+ registered users), ~13.5k
  behavioural sessions, ~101k events, 6.4k learning resources, 4.3k learning
  interactions, 4 demo quizzes (20 items), and the FES history/weight
  collections.
- **Evaluation:** `make eval` runs the four pilot studies and writes
  `evaluation/results/pilot_results.json` (FES validity, recommender
  benchmark, DQN convergence, sensitivity sweeps).

## Testing

```bash
# full suite: ML package + LLM gateway + evaluation + backend (venv-aware,
# per-suite invocations — ml/tests, llm_gateway/tests and evaluation/tests
# all own the `tests` package)
make test

# single suites, e.g.:
cd backend && python -m pytest apps
PYTHONPATH=ml python -m pytest ml/tests
# ML suite includes Phase 1 simulator validation: TCR↔ability, QAP↔motivation
# and outcome↔ability correlations, determinism, KG eligibility math
```

## Pilot study (evaluation)

```bash
make eval      # PYTHONPATH=ml:evaluation python evaluation/run_pilot.py
```

Four studies (paper Sec. VIII), results also written to
`evaluation/results/pilot_results.json`:

1. **FES predictive validity** — Pearson r of FES/sub-metrics vs mean grade
   (TCR strongest ≈ 0.64; per-student Eq. 2 weights vs the 2-student
   population fallback, whose n=2 group correlations are undefined).
2. **Recommender benchmark** — leave-one-out over interactions: the 3-stage
   cascade reaches Hit@10 ≈ 0.82 alongside single-technique baselines
   (fm_only ≈ 0.86, cf_only ≈ 0.79, popularity ≈ 0.72, kg_only ≈ 0.55); the
   stage-1 gate passes on average 16.2 of 18 pathways at the paper's 0.6
   threshold.
3. **DQN convergence** — training curve read from
   `ml/artifacts/dqn_training.json` (reward climbs ≈ +6.5 → +8.9 over
   1000 episodes).
4. **Sensitivity** — sweeps over the stage-1 gate (hit@k 0.86 → 0.51 across
   0.4 → 0.8), EngagementSignal thresholds (the interaction-rate threshold is
   the binding constraint: positive rate 67% → 2% as it rises 1.5 → 4.0
   actions/min), the ≥8-session calibration gate, and Eq. 3 reward weights
   (γ-heavy weighting dominates in the reward metric).

## Training CLI (Part B)

```bash
python -m careermind_ml.train --module fes      --config ml/configs/fes.yaml
python -m careermind_ml.train --module fm       --config ml/configs/fm.yaml
python -m careermind_ml.train --module dqn      --config ml/configs/dqn.yaml
python -m careermind_ml.train --module ensemble --config ml/configs/ensemble.yaml
```

Paper constants (EngagementSignal thresholds, ≥8-session calibration rule, 10k
replay buffer, target-network sync every 100 steps, Eq. 3 reward weights) live in
`ml/configs/*.yaml`.

## Reproducibility

First run on a fresh clone:

```bash
cp .env.example .env                      # LLM_API_KEY optional (Part A degrades without it)
docker run -d -p 27017:27017 mongo:7
docker run -d -p 6379:6379 redis:7-alpine
make seed                                 # deterministic: --seed 42 by default
cd backend && python manage.py runserver  # :8000
cd frontend && npm install && npm run dev # :3000
```

**Identical to this machine:**

- **Data** — `make seed` defaults to `--seed 42`, so the knowledge graph, demo
  quizzes, simulated students/sessions/events and the FES population weights
  come out byte-identical.
- **Model outputs** — the trained artifacts are committed
  (`ml/artifacts/ensemble.joblib`, `fm.pt`, `dqn.pt` + their `*_spec.json` /
  `dqn_training.json`), so career prediction, recommendations and the RL action
  endpoint serve the same scores with **no torch install and no training**.
  They contain only model weights, feature schema and aggregate statistics —
  no PII, no secrets. Treat any change to them in review like a code change
  (they are pickle-based and executed on load).
- **Static roadmaps** — `frontend/src/data/roadmaps/*.json` (zod-validated) and
  frontend deps via the committed `frontend/package-lock.json`.

**Differs:**

- **LLM text** — roadmap generation, quiz generation and "Why this?" answers
  depend on your `LLM_API_KEY`, the provider and model version; wording varies
  run to run. Without a key those endpoints return 503 and the UI degrades
  gracefully.
- **Python dependencies** — `backend/requirements.txt` and the `ml` /
  `llm_gateway` pyprojects declare version *ranges*, not a lockfile, so a clone
  may resolve newer minor versions than the ones used here.
- **Retraining** — `make train-*` rewrites the artifacts. The ensemble is
  sklearn with `random_state: 42` (near-identical), while torch training
  (FM, DQN) varies slightly across platforms and versions.
- **Regenerable/downloaded files** — `frontend/public/fes-simulation.html`
  (`make simulate-fes-html`) and `data/oulad/raw/` (`python
  data/oulad/download.py`) are gitignored on purpose.

## Roadmap (implementation phases)

0. **Skeleton** — structure, stubs, docker-compose, seed data
1. **Data foundation** — OULAD ingestion (verified mirror), 200-student synthetic simulator calibrated to OULAD, knowledge-graph loader, pathways API
2. **FES engine** — five sub-metrics, Eq. 2 per-student weight calibration (gates + population fallback), batch pipeline, FES read APIs
3. **Backend core** — JWT auth (register/login/me/refresh), behavioural collector (session lifecycle + event ingestion), session-end FES via Celery, quiz attempts (FR04), frontend login + JWT'd tracking
4. **Recommender** — 3-stage cascade live: KG filtering (≥60%), FES-weighted CF re-ranking, trained FM (held-out AUC 0.84) with accept/reject logging; population-profile cold start
5. **Career prediction ensemble** — stacking RF+GBT+MLP → LR meta (held-out acc 0.95 incl. stated preferences; no-preference ablation 0.35), occlusion feature attribution, `GET /careers/predictions` + live `/prediction` page
6. **RL adaptive feedback** — gymnasium simulator environment with the paper's 8 interventions, Eq. 3 reward (α·dFES + β·dSkill + γ·E + δ·CA), DQN pre-training (1000 episodes / 60k steps, reward +6.5 → +8.9), artifact serving, and `GET /rl/status` + `POST /rl/action` transition-logging API
7. **LLM gateway (Part A)** — OpenAI/Anthropic/Gemini adapters, agency-preserving grounded guidance chat (`POST /llm/chat`, per-student history window), LLM quiz generation (`POST /llm/quiz/generate`), cached recommendation explanations (`GET /recommendations/<id>/explain`), live `/chat` page; 503 without `LLM_API_KEY`, 502 on provider failure
8. **Full frontend** — live recommendations page (cascade provenance, accept/reject, "Why this?" explanations), quiz page (seeded demos + AI generation, per-item attempt recording into QAP), dashboard 14-day FES trend chart, live `/chat` and `/prediction` pages
9. **Evaluation / pilot study** — `evaluation/` package: leave-one-out benchmark (cascade vs kg/cf/fm/popularity, P@k/R@k/nDCG@k/Hit@k + gate pass-rate diagnostic), FES predictive-validity study, DQN convergence readout, and five sensitivity sweeps (Sec. VIII #4); `make eval` runs all four studies into `evaluation/results/pilot_results.json`; simulator fixes surfaced along the way (EngagementSignal action-density reachable, full skill profiles so the eligibility gate measures skill coverage rather than assessment coverage, idempotent event seeding)
10. **Deployment polish** — Dockerfiles rebuilt around a repo-root context so
    the images ship `careermind_ml` + `careermind_llm` (editable) with CPU
    torch, baked artifacts, and the seeder; compose validated end-to-end
    (5 services, in-container seeding, register → recommend → RL E2E smoke);
    `.dockerignore`s, env-backed seeder defaults, and this README/architecture
    pass

See `docs/architecture.md` for the component/data-flow diagram (Fig. 1).

## Career Roadmaps (frontend)

The roadmap.sh-style **Career Roadmaps** feature lives entirely in the frontend
and is JSON-driven. Progress is stored in `localStorage` behind a swappable
storage abstraction (`frontend/src/lib/roadmap/storage.ts`), so a backend
endpoint can be dropped in later without touching any component.

### Routes & integration

- `/roadmap/:careerSlug` — the interactive flowchart (client route:
  `frontend/src/app/(main)/roadmap/[slug]/page.tsx`).
- **Recommendations** — each career name and its "View Roadmap →" action link to
  `/roadmap/<slugify(career name)>` (see `frontend/src/lib/roadmap/slug.ts`).
- **Dashboard** — a "My Roadmaps" section reads the same progress store, so the
  roadmap page and dashboard can never disagree (single source of truth:
  `frontend/src/lib/roadmap/ProgressStore.tsx`).

### Adding a new career roadmap

Only the **content** is authored as JSON; registering it is one mechanical line.

1. **Create the file** `frontend/src/data/roadmaps/<slug>.json`, where `<slug>`
   is `slugify(career name)` exactly as the API returns it — e.g. `Data
   Engineer` → `data-engineer.json`, `AR/VR Developer` → `ar-vr-developer.json`.

2. **Register it** in `frontend/src/lib/roadmap/registry.ts` with two lines — an
   import and an entry in the `RAW` array:

   ```ts
   import dataEngineer from "@/data/roadmaps/data-engineer.json";
   // ...
   const RAW = [ /* ...existing... */, dataEngineer ];
   ```

3. **Validate.** `npm run build` (or `npm run dev`) validates the file with zod
   at load. In development a bad file throws loudly with the exact zod issue; in
   production it is dropped and the route shows a friendly error instead of
   crashing the app.

Any career without a roadmap file automatically shows the "Roadmap coming soon"
fallback page, so you never have to add them all at once.

### JSON shape

```jsonc
{
  "slug": "data-engineer",            // must equal the file name
  "title": "Data Engineer",
  "description": "One-line overview.",
  "version": 1,
  "nodes": [
    {
      "id": "sql",                     // stable, unique (progress keys off this)
      "kind": "topic",                 // topic | section | info | roadmapLink
      "lane": "spine",                 // spine | left | right
      "label": "SQL",
      "description": "Shown in the detail drawer.",
      "parentId": "databases",         // optional; groups under a spine node
      "resources": [
        { "title": "PostgreSQL Docs",
          "url": "https://www.postgresql.org/docs/",
          "type": "official",          // course|official|video|article|book|practice
          "free": true }
      ]
    }
  ],
  "edges": []                          // optional; connectors are derived from lanes
}
```

**Node kinds**

- `topic` — a progress-bearing node (`lane: "spine"` = yellow main path,
  `lane: "left" | "right"` = tan sub-topic beside the spine).
- `section` — a plain text label row (e.g. "Advanced").
- `info` — a reusable `InfoCard`: light box with guidance text and a grey
  button (taken from its first resource).
- `roadmapLink` — a solid blue node linking to another roadmap via `linkTo`.

**Rules enforced by the schema (`frontend/src/types/roadmap.ts`)**

- Node ids must be unique and stable; `parentId` and `edges` must reference ids
  that exist.
- Resource URLs must be valid `http(s)`.
- Aim for **40–80 nodes** covering fundamentals → tools → advanced →
  specialization → projects, with 2–6 real resources per topic.

**Progress:** `done / (total topic nodes − skipped)`. Section, info and
roadmapLink nodes never count. Progress entries pointing at node ids that no
longer exist are ignored, so bumping `version` never breaks saved progress.

### Feature flag

The AI Tutor (drawer tab + floating pill) is a stub behind
`NEXT_PUBLIC_AI_TUTOR=true`. Everything else works with the flag off.

### AI-generated roadmaps (Google Gemini)

Careers without a curated JSON file can still get a roadmap: the app asks
**Google Gemini** (through the existing `careermind_llm` gateway) to build one
on demand and saves it to the user's Dashboard.

**Entry points**

- `/roadmap/:slug` for a career with no seed data shows the request box
  (pre-filled from the slug) instead of the plain "coming soon" card.
- **Dashboard → My Roadmaps** has a request box (prominent when empty,
  "Request another roadmap" when cards exist). Type any career name.

**Flow**

1. `POST /api/v1/roadmaps/generate { career, context? }` (JWT required) calls
   `careermind_llm.roadmapgen.generate_roadmap()` — the Gemini adapter with
   the same quota-failover chain as chat/quiz (`LLM_FALLBACK_MODELS`).
2. The model returns a *simplified* payload (sections → topics → subtopics +
   resources). `build_roadmap()` converts it to the full schema
   deterministically: unique ids, alternating `left`/`right` lanes, clamped
   sizes (8 sections / 10 topics / 5 subtopics / 6 resources), http(s)-only
   resource URLs, unknown types coerced to `article`. `edges` stays empty —
   connectors are derived from lanes at render time, like the seed files.
3. The roadmap is persisted per-student in Mongo (`generated_roadmaps`,
   unique per `(student, slug)` — regenerating replaces) and returned to the
   client, which mirrors it into `localStorage`
   (`cm_generated_roadmaps_v1`, zod-validated on read and write).
4. `getRoadmap()` in `registry.ts` falls back to that store, so the canvas,
   drawer, progress store and dashboard all render generated roadmaps with
   **zero component changes**.

**Related endpoints** (all JWT-scoped to the owning student)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/roadmaps/generate` | Generate/replace a roadmap (400 validation, 503 no `LLM_API_KEY`, 502 provider failure, 429 throttled) |
| GET | `/api/v1/roadmaps/mine` | List the student's generated roadmaps (newest first, capped at 50) |
| GET | `/api/v1/roadmaps/:slug` | Fetch one; **404** for slugs the student does not own |

**Configuration** — uses the existing `LLM_API_KEY` (and `LLM_MODEL` when it
names a Gemini model). Optional override for the generation model only:

```bash
ROADMAP_LLM_MODEL=gemini-3.5-flash   # defaults to gemini-3.5-flash
```

**Client store** — `frontend/src/lib/roadmap/generated.ts`: in-memory cache
backed by `localStorage`, corrupt/invalid entries dropped on read, and a
`useGeneratedRoadmaps()` subscription so pages re-render the moment a roadmap
is generated or restored from another device.

**Known caveats**

- Generated resource links are **not verified to resolve** — they are
  shape-validated only (http(s) + known type). They come straight from the
  model.
- Generation requires login (roadmaps are stored per-student); offline/401
  states show a friendly message.
- Seeded roadmaps always win over a generated one with the same slug.
- Dashboard *membership* is progress-driven per device: a roadmap generated on
  another device is fetched into the store when you open the Dashboard or the
  roadmap URL, but it only gains a card there once opened (progress itself is
  still localStorage-only behind the `ProgressAdapter` abstraction).
