"""Built-in workout templates shown in the frontend's Templates gallery.

These are fully-structured `Workout` objects — no LLM round-trip needed since
the shape is fixed and well-understood ahead of time. `seed_workout_templates`
upserts this list into the `workout_templates` table on every app startup, so
a fresh database (e.g. a new deployment) always has them without a manual
migration step. Rows are keyed by `id`, so adding a new template here (or
directly in the database) doesn't disturb existing ones, and edits to an
existing template's copy here do propagate on the next restart.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.models.workout_template import WorkoutTemplateRow
from app.schemas.workout import DistanceGoal, Goal, HRZone, Step, StepRole, TimeGoal, Workout


def _step(label: str, goal: Goal, zone: Literal[1, 2, 3, 4, 5], role: StepRole) -> Step:
    return Step(label=label, goal=goal, target=HRZone(zone=zone), role=role, sport="running")


def _time(seconds: float) -> Goal:
    return TimeGoal(value=seconds)


def _dist(meters: float) -> Goal:
    return DistanceGoal(value=meters)


@dataclass(frozen=True)
class TemplateSeed:
    id: str
    name: str
    category: str
    structure: str
    intensity: str
    purpose: str
    workout: Workout


SEED_TEMPLATES: list[TemplateSeed] = [
    TemplateSeed(
        id="norwegian-4x4",
        name="Norwegian 4×4",
        category="Interval Training (VO2max)",
        structure="4 × 4 min hard, 3 min easy recovery between",
        intensity="85–95% HRmax (RPE 8–9)",
        purpose="Boosts VO2max — the gold standard for endurance adaptation",
        workout=Workout(
            name="Norwegian 4×4",
            sport="running",
            warmup=_step("Warmup", _time(720), 2, "warmup"),
            body=[
                {
                    "kind": "repeat",
                    "count": 4,
                    "steps": [
                        _step("Hard", _time(240), 4, "work"),
                        _step("Easy", _time(180), 2, "recovery"),
                    ],
                }
            ],
            cooldown=_step("Cooldown", _time(600), 1, "cooldown"),
        ),
    ),
    TemplateSeed(
        id="short-intervals-1000",
        name="Short Intervals (6 × 1000 m)",
        category="Interval Training (VO2max)",
        structure="6 × 1000 m, jog recovery of 400–1000 m",
        intensity="3–5K race pace (95–100% HRmax)",
        purpose="Running economy, VO2max, race-pace feel",
        workout=Workout(
            name="Short Intervals 6×1000m",
            sport="running",
            warmup=_step("Warmup", _time(900), 2, "warmup"),
            body=[
                {
                    "kind": "repeat",
                    "count": 6,
                    "steps": [
                        _step("1000m hard", _dist(1000), 5, "work"),
                        _step("Jog", _dist(400), 1, "recovery"),
                    ],
                }
            ],
            cooldown=_step("Cooldown", _time(600), 1, "cooldown"),
        ),
    ),
    TemplateSeed(
        id="30-30",
        name="30/30 Intervals",
        category="Interval Training (VO2max)",
        structure="30 sec fast / 30 sec easy, 15 repetitions",
        intensity="near maximal pace",
        purpose="VO2max, anaerobic capacity — a good entry point into interval training",
        workout=Workout(
            name="30/30 Intervals",
            sport="running",
            warmup=_step("Warmup", _time(600), 2, "warmup"),
            body=[
                {
                    "kind": "repeat",
                    "count": 15,
                    "steps": [
                        _step("Fast", _time(30), 5, "work"),
                        _step("Easy", _time(30), 1, "recovery"),
                    ],
                }
            ],
            cooldown=_step("Cooldown", _time(600), 1, "cooldown"),
        ),
    ),
    TemplateSeed(
        id="tempo-run",
        name="Tempo Run",
        category="Threshold Training",
        structure="20–30 min continuous at threshold pace (after a 10 min warm-up jog)",
        intensity='88–92% HRmax, "comfortably hard" (RPE 7)',
        purpose="Raises the lactate threshold",
        workout=Workout(
            name="Tempo Run",
            sport="running",
            warmup=_step("Warm-up jog", _time(600), 2, "warmup"),
            body=[_step("Threshold pace", _time(1500), 4, "work")],
            cooldown=_step("Cooldown", _time(600), 1, "cooldown"),
        ),
    ),
    TemplateSeed(
        id="cruise-intervals",
        name="Cruise Intervals",
        category="Threshold Training",
        structure="5 × 6 min at threshold pace, 90 sec jog recovery",
        intensity="same as tempo run, but broken into intervals",
        purpose="Same goal as the tempo run, but easier to tolerate",
        workout=Workout(
            name="Cruise Intervals",
            sport="running",
            warmup=_step("Warmup", _time(900), 2, "warmup"),
            body=[
                {
                    "kind": "repeat",
                    "count": 5,
                    "steps": [
                        _step("Threshold pace", _time(360), 4, "work"),
                        _step("Jog", _time(90), 1, "recovery"),
                    ],
                }
            ],
            cooldown=_step("Cooldown", _time(600), 1, "cooldown"),
        ),
    ),
    TemplateSeed(
        id="long-run",
        name="Long Run (Aerobic Base)",
        category="Base Endurance",
        structure="90 min, adjust to target race distance",
        intensity="65–75% HRmax, conversational pace",
        purpose="Aerobic base, mitochondrial adaptation, mental endurance",
        workout=Workout(
            name="Long Run",
            sport="running",
            body=[_step("Long Run", _time(5400), 2, "work")],
        ),
    ),
    TemplateSeed(
        id="recovery-run",
        name="Recovery Run",
        category="Base Endurance",
        structure="20–40 min very easy",
        intensity="<65% HRmax, RPE 3–4",
        purpose="Active recovery, blood flow",
        workout=Workout(
            name="Recovery Run",
            sport="running",
            body=[_step("Easy", _time(1800), 1, "work")],
        ),
    ),
    TemplateSeed(
        id="fartlek",
        name="Fartlek (Speed Play)",
        category="Variable Intensity",
        structure="10 × 1 min fast / 1 min easy, free-form by feel",
        intensity="variable, 70–95% HRmax",
        purpose="Builds pace-change ability, fun, good for transition phases",
        workout=Workout(
            name="Fartlek",
            sport="running",
            warmup=_step("Warmup", _time(600), 2, "warmup"),
            body=[
                {
                    "kind": "repeat",
                    "count": 10,
                    "steps": [
                        _step("Fast", _time(60), 4, "work"),
                        _step("Easy", _time(60), 2, "recovery"),
                    ],
                }
            ],
            cooldown=_step("Cooldown", _time(300), 1, "cooldown"),
        ),
    ),
    TemplateSeed(
        id="progression-run",
        name="Progression Run",
        category="Variable Intensity",
        structure="Even build-up: easy / moderate / fast thirds",
        intensity="rising from 70% to 90+% HRmax",
        purpose="Pacing practice, negative splits",
        workout=Workout(
            name="Progression Run",
            sport="running",
            body=[
                _step("Easy", _time(600), 2, "work"),
                _step("Moderate", _time(600), 3, "work"),
                _step("Fast", _time(600), 4, "work"),
            ],
            cooldown=_step("Cooldown", _time(300), 1, "cooldown"),
        ),
    ),
    TemplateSeed(
        id="pyramid",
        name="Pyramid Training",
        category="Variable Intensity",
        structure="200-400-800-1200-800-400-200 m, recovery proportional to effort",
        intensity="90–100% HRmax",
        purpose="Combines speed and endurance",
        workout=Workout(
            name="Pyramid Training",
            sport="running",
            warmup=_step("Warmup", _time(900), 2, "warmup"),
            body=[
                _step("200m", _dist(200), 5, "work"),
                _step("Jog", _dist(200), 1, "recovery"),
                _step("400m", _dist(400), 5, "work"),
                _step("Jog", _dist(400), 1, "recovery"),
                _step("800m", _dist(800), 5, "work"),
                _step("Jog", _dist(800), 1, "recovery"),
                _step("1200m", _dist(1200), 4, "work"),
                _step("Jog", _dist(1200), 1, "recovery"),
                _step("800m", _dist(800), 5, "work"),
                _step("Jog", _dist(800), 1, "recovery"),
                _step("400m", _dist(400), 5, "work"),
                _step("Jog", _dist(400), 1, "recovery"),
                _step("200m", _dist(200), 5, "work"),
            ],
            cooldown=_step("Cooldown", _time(600), 1, "cooldown"),
        ),
    ),
    TemplateSeed(
        id="hill-sprints",
        name="Hill Sprints",
        category="Strength & Economy",
        structure="8 × 12 sec uphill sprint, full recovery (walk/jog back down)",
        intensity="maximal, but short",
        purpose="Strength, running form, injury prevention, low joint stress",
        workout=Workout(
            name="Hill Sprints",
            sport="running",
            warmup=_step("Warmup", _time(900), 2, "warmup"),
            body=[
                {
                    "kind": "repeat",
                    "count": 8,
                    "steps": [
                        _step("Uphill sprint", _time(12), 5, "work"),
                        _step("Recovery", _time(90), 1, "recovery"),
                    ],
                }
            ],
            cooldown=_step("Cooldown", _time(600), 1, "cooldown"),
        ),
    ),
]


def seed_workout_templates(db: Session) -> None:
    """Idempotently upsert the built-in templates. Safe to call on every startup:
    existing rows are updated in place (by id), custom rows added directly in
    the database are left untouched."""
    for order, seed in enumerate(SEED_TEMPLATES):
        row = db.get(WorkoutTemplateRow, seed.id)
        payload = seed.workout.model_dump(mode="json")
        if row is None:
            row = WorkoutTemplateRow(id=seed.id)
            db.add(row)
        row.name = seed.name
        row.category = seed.category
        row.structure = seed.structure
        row.intensity = seed.intensity
        row.purpose = seed.purpose
        row.payload = payload
        row.sort_order = order
    db.commit()
