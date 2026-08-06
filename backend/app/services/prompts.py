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
      "cooldown": <Step> | null,
      "pool_length_m": <meters>  // swimming only; default 25
    }

    Step:
      {
        "kind": "step",          // literal
        "label": "<string>",     // shown as the step's note on the watch
        "goal":
          { "kind": "time",       "value": <seconds> }
          | { "kind": "distance",   "value": <meters> }
          | { "kind": "lap_button" }
              // open-ended: ends when the athlete presses the lap button
          | { "kind": "calories",   "value": <kcal> }
          | { "kind": "heart_rate", "value": <bpm> }
              // ends once heart rate reaches this value
          | { "kind": "power",      "value": <watts> }
              // cycling only — ends once power reaches this value
        "target":
          { "kind": "pace",       "min_sec_per_km": <sec>, "max_sec_per_km": <sec> }
              // running only
          | { "kind": "swim_pace", "sec_per_100m": <sec> }
              // swimming — a single pace value, not a range
          | { "kind": "swim_css_pace", "offset_seconds": <sec> }
              // swimming — offset (+/-/0) from the athlete's Critical Swim Speed
          | { "kind": "swim_effort", "level": <SwimEffortLevel> }
              // swimming — named exertion level instead of a pace number.
              // SwimEffortLevel: "recovery"|"easy"|"moderate"|"hard"
              // |"very_hard"|"maximum"|"ascending"|"descending"
          | { "kind": "power",      "min_watts": <w>, "max_watts": <w> }
              // cycling — custom watt range
          | { "kind": "power_zone", "zone": 1|2|3|4|5|6|7 }
              // cycling — predefined power zone
          | { "kind": "power_curve", "interval": <PowerCurveInterval>, "percent": <percent> }
              // cycling — % of the athlete's best-ever power for that
              // interval duration. PowerCurveInterval: "5s"|"10s"|"20s"
              // |"30s"|"1min"|"2min"|"5min"|"10min"|"20min"|"30min"|"1hour"
          | { "kind": "speed",      "min_kmh": <kmh>, "max_kmh": <kmh> }
              // cycling — speed range in km/h
          | { "kind": "cadence",    "min_cadence": <spm|rpm>, "max_cadence": <spm|rpm> }
              // running (spm) or cycling (rpm)
          | { "kind": "hr_zone",    "zone": 1|2|3|4|5 }
          | { "kind": "hr_custom",  "min_bpm": <bpm>, "max_bpm": <bpm> }
          | { "kind": "no_target" },
        "role": "warmup" | "work" | "recovery" | "rest" | "other" | "cooldown",
        "sport": "running" | "cycling" | "swimming",
        "stroke": <SwimStroke> | null,
            // swimming only — set this whenever the description names a
            // stroke (e.g. "freestyle", "backstroke", "kraul", "IM").
            // SwimStroke: "choice"|"backstroke"|"breaststroke"|"butterfly"
            // |"freestyle"|"im"|"various"|"im_ladder"|"im_reverse". null
            // means unspecified ("Wahl"), not "freestyle" — never guess a
            // stroke the text doesn't mention.
        "equipment": "fins"|"kickboard"|"paddles"|"pull_buoy"|"snorkel"|null,
            // swimming only — set when the description names swim gear
            // (fins, kickboard/board, paddles, pull buoy, snorkel).
        "drill": "kick"|"pull"|"drill"|null,
            // swimming only — Garmin's "exercise type". Set "kick" for a
            // kick-only set, "pull" for a pull-only set (arms only, often
            // with a pull buoy), "drill" for a named technique drill. null
            // for normal swimming.
        "secondary_target": <Target> | null
            // cycling only — a second target stacked on the primary one
            // (e.g. power zone + cadence). Rarely needed; null by default.
      }

    RepeatBlock:
      { "kind": "repeat", "count": <int 1..50>, "steps": [ <Step>, ... ] }

    Rules:
    - Use "kind" as the literal discriminator on every body item, goal, and target.
    - Pace is in seconds per kilometer (running) or per 100m (swimming, via "swim_pace").
    - Choose the target type that matches the sport. Default to "pace" for
      running, "swim_pace" for swimming, and "power" for cycling unless the
      description asks for cadence, a heart-rate target, or explicitly says
      "no target".
    - Default to a "time" or "distance" goal. Only use "lap_button",
      "calories", or "heart_rate" goals when the description explicitly
      asks for one of those (e.g. "until lap button", "until 300 kcal",
      "until heart rate hits 160").
    - "recovery" (jogging/easing off) and "rest" (standing still / walking)
      are different Garmin step types — pick "rest" only when the
      description clearly means a full stop or walk, not an easy jog.
    - Repeat blocks should be used when the description has a "Nx" pattern.
    - For swimming, always set "stroke" on a step when the description names
      one, and leave it null otherwise — don't default every step to
      "freestyle".
    - For swimming, set "drill" to "kick" or "pull" when the description
      calls for a kick-only or pull-only set, and "drill" for a named
      technique drill (e.g. catch-up, fingertip drag); leave it null for
      normal swimming.

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


def build_messages(*, mode: str, user_text: str, sport: str | None = None) -> list[dict[str, str]]:
    """Return a chat-format message list for Ollama.

    `mode` is "free_text" or "template". `sport`, if given, pins the target
    sport instead of letting the model infer it from the text.
    """
    if mode not in {"free_text", "template"}:
        raise ValueError(f"unknown mode: {mode!r}")

    system = FREE_TEXT_SYSTEM if mode == "free_text" else TEMPLATE_SYSTEM
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": _user_instructions()},
    ]
    if sport:
        messages.append(
            {
                "role": "user",
                "content": (
                    f'Generate this workout for sport "{sport}". Set "sport" to '
                    f'"{sport}" on the workout and on every step — do not infer a '
                    "different sport from the text."
                ),
            }
        )
    messages.append({"role": "user", "content": user_text})
    return messages


def retry_message(error: str) -> str:
    return (
        f"Your previous response failed validation: {error}\n\n"
        "Respond again with a single JSON object that matches the schema. "
        "Do not add explanations or markdown."
    )
