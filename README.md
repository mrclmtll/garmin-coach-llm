# Garmin Coach

A personal training tool. Describe a workout in plain text (or paste a
template), tweak it in the editor, and push it to your Garmin device.

Built for the case where the coach and the athlete are the same person — no
accounts, no calendar, no analytics. Just: text → structured workout → Garmin.

## How it works

```
[ free text ]  ──┐
                 ├──> local LLM (Ollama) ──> structured workout ──> Garmin
[ template  ]  ──┘
[ edit in UI ] ───────────────────────────^
```

The LLM runs locally via [Ollama](https://ollama.com) — no API keys, no
cloud. It turns your description into a canonical workout (warmup / body /
cooldown, with steps and repeat blocks), which you can edit in the UI
before pushing to your device through the unofficial
[garminconnect](https://github.com/cyberjunky/python-garminconnect) library.

## Stack

- **Backend** — Python 3.11+, FastAPI, SQLAlchemy (SQLite, Postgres-portable),
  Pydantic v2
- **Frontend** — React + Vite + Tailwind
- **LLM** — local Ollama (`http://localhost:11434`)
- **Garmin** — `garminconnect` (unofficial)

## Setup

You need three things on your machine: Python 3.11+, Node 20+, and
[Ollama](https://ollama.com) running locally with a chat model pulled.

```bash
# 1. Pull the LLM (any chat model works; qwen2.5 is a reasonable default)
ollama pull qwen2.5
curl http://localhost:11434/api/tags  # should list the model
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

cp .env.example .env
# Edit .env and set GARMIN_EMAIL / GARMIN_PASSWORD.
# On first push you'll log in interactively and the session token is cached
# in .garmin_tokens/ so you don't have to re-authenticate.

uvicorn app.main:app --reload
```

The API is at `http://localhost:8000`; interactive docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server proxies `/api` to the backend (see `vite.config.ts`).

## Usage

1. Open the app.
2. Type a workout ("30 min easy run, 6x800m at 4:10/km with 400m jog recovery,
   cool down 1 km") or paste a template.
3. Click **Generate**. The LLM fills in a structured workout — review and
   edit anything that's off.
4. Click **Push to Garmin**. The workout is uploaded to your account and
   shows up on your device.

## Logs and debugging

Every request gets a short id (returned as `X-Debug-Request-Id` and printed
to the browser console). All LLM traffic — user input, the full message
stack sent to Ollama, raw responses, parse errors, retries — is logged to
`backend/logs/garmin-coach.log` (rotating, 5 MB × 3 backups). When a
generated workout looks wrong, the id is the bridge to the full trace.

Set `LOG_LEVEL=DEBUG` in `.env` to also see debug lines on stdout.

## Project layout

```
backend/
  app/
    main.py            # FastAPI app + request-id middleware
    config.py          # env-driven config
    db.py              # SQLAlchemy engine + session
    models/            # ORM models
    schemas/           # Pydantic models
    services/
      llm.py           # Ollama client, JSON-mode + Pydantic validation + retry
      prompts.py       # system prompts (free text vs. template)
      garmin.py        # pushes workouts via garminconnect
      garmin_format.py # internal Workout -> garminconnect format
    routers/
      workouts.py      # /workouts endpoints
    logging_config.py  # console + rotating file handler
    logging_context.py # per-request id via contextvars
  tests/
frontend/
  src/
    pages/WorkoutBuilder.tsx
    components/        # StepCard, RepeatBlockView
    api/               # typed backend client
```

## Scope

This is a personal tool. Single user, one device, no calendar, no
dashboard, no athlete management. The architecture keeps that boundary at a
single internal `Workout` schema so future features can be added without
rewriting the LLM or Garmin integration.

## Tests / lint

```bash
cd backend && pytest
cd backend && ruff check . && ruff format .
cd frontend && npm run lint
```
