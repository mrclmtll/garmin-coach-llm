"""Workout-generation prompts.

Two flavors — both produce the same `Workout` shape, only the system prompt
differs:

- `FREE_TEXT_SYSTEM`     — the model is allowed to invent/derive structure
                            from a free-text description.
- `TEMPLATE_SYSTEM`      — the model is asked to *translate* given structure
                            (a JSON-ish template, a paste, a tabular example)
                            into the canonical schema. It must not invent
                            steps that aren't implied by the input.
"""

from __future__ import annotations

from textwrap import dedent

from app.schemas.workout import Workout

SCHEMA_DESCRIPTION: str = dedent(
    """
    A workout is a JSON object with this exact shape:

    {
      "name": "<string>",
      "sport": "running" | "cycling" | "swimming",
      "warmup":  <Step> | null,
      "body":    [ <Step> | <RepeatBlock>, ... ],
      "cooldown": <Step> | null
    }

    Step:
      {
        "kind": "step",          // literal
        "label": "<string>",
        "goal":  { "kind": "time" | "distance", "value": <number> },
                 // value is seconds when kind=time, meters when kind=distance
        "target":
          { "kind": "pace",    "min_sec_per_km": <sec>, "max_sec_per_km": <sec> }   // running, swimming
          | { "kind": "power",  "min_watts": <w>, "max_watts": <w> }                  // cycling
          | { "kind": "hr_zone","zone": 1|2|3|4|5 },
        "role": "warmup" | "work" | "recovery" | "cooldown",
        "sport": "running" | "cycling" | "swimming"
      }

    RepeatBlock:
      { "kind": "repeat", "count": <int 1..50>, "steps": [ <Step>, ... ] }

    Rules:
    - Use "kind" as the literal discriminator on every body item and step.
    - Pace is in seconds per kilometer (running/swimming).
    - Choose the target type that matches the sport.
    - Repeat blocks should be used when the description has a "Nx" pattern.

    Pace formatting:
    - Pace is a small number of seconds per km. Faster running = SMALLER
      sec/km. A 4:00/km interval is 240 sec/km, not 4. A 5:30/km easy jog
      is 330 sec/km, not 5.3. A recovery jog is several hundred sec/km, not
      a few dozen.
    - Round pace values to the nearest 5 seconds. Do not invent a lower
      bound — running pace is realistic anywhere from about 150 sec/km
      (very fast intervals) up to 600 sec/km (very easy jogs), and
      everything in that range is valid. The 5-second rule is purely about
      snapping to clean numbers like 240, 245, 250 — not 247 or 253.
    - Keep the pace range narrow: min_sec_per_km and max_sec_per_km should
      differ by at most 20 seconds. The range is where to aim on a given
      day, not the full possible spectrum.
    """
).strip()


def _user_instructions() -> str:
    schema_json = Workout.model_json_schema()
    return (
        "Respond with a single JSON object that matches this JSON Schema "
        "(do not include explanations or markdown fences):\n\n"
        f"```json\n{schema_json}\n```"
    )


FREE_TEXT_SYSTEM: str = (
    "You are a running/cycling/swimming coach. Convert a free-text workout "
    "description into a structured workout. Make sensible coaching decisions "
    "(pace, HR zone) when the description is informal.\n\n"
    f"{SCHEMA_DESCRIPTION}"
)

TEMPLATE_SYSTEM: str = (
    "You are a workout normalizer. The user will paste an existing workout — "
    "in their own JSON, a tabular example, or a structured text template. "
    "Translate it into the canonical schema. Do not invent steps, distances, "
    "or paces that aren't implied by the input. Preserve the structure of "
    "the input; only normalize field names and units.\n\n"
    f"{SCHEMA_DESCRIPTION}"
)


def build_messages(*, mode: str, user_text: str) -> list[dict[str, str]]:
    """Return a chat-format message list for Ollama.

    `mode` is "free_text" or "template".
    """
    if mode not in {"free_text", "template"}:
        raise ValueError(f"unknown mode: {mode!r}")

    system = FREE_TEXT_SYSTEM if mode == "free_text" else TEMPLATE_SYSTEM
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": _user_instructions()},
        {"role": "user", "content": user_text},
    ]


def retry_message(error: str) -> str:
    return (
        f"Your previous response failed validation: {error}\n\n"
        "Respond again with a single JSON object that matches the schema. "
        "Do not add explanations or markdown."
    )
