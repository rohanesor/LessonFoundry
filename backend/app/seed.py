"""Explicit development fixture, never substituted for a real model response."""

from app.database import Base, engine, transaction
from app.models.entities import *
from app.services.packs import add_source
from app.api.routes import create, gap, generate
from app.jobs.worker import tick
from app.schemas.contracts import PackInput

SOURCE = """Newton's Laws of Motion — teacher-authored demonstration notes.
Newton's first law: an object remains at rest or moves with constant velocity unless acted on by a nonzero resultant external force. Inertia is resistance to a change in velocity. Mass measures inertia.
Newton's second law: for a constant-mass object in an inertial frame, the resultant external force F equals mass m multiplied by acceleration a: F = ma. The SI unit of force is the newton. A 2 kg object with acceleration 3 m/s² experiences a resultant force of 6 N.
Newton's third law: when one body exerts a force on a second body, the second exerts an equal and opposite force on the first. These forces act on different bodies and do not cancel on a single-body free-body diagram.
A free-body diagram shows the external forces acting on one chosen object. Label each force and choose axes before applying F = ma. For a book at rest on a horizontal table with no other vertical forces, the upward normal force balances its downward weight.
Exam preparation: distinguish velocity from acceleration, and distinguish forces on one object from an action–reaction pair. For force problems identify the object, list external forces, find the resultant, then use F = ma. These notes contain no verified past examination questions."""


def main():
    Base.metadata.create_all(engine)
    with transaction() as s:
        if not s.get(User, "local-teacher"):
            s.add(User(id="local-teacher", name="Priya Nair"))
    result = create(
        PackInput(
            title="Newton's Laws of Motion",
            summary="Force, acceleration and numerical reasoning.",
            objectives=[
                "Explain Newton's three laws of motion",
                "Solve force and acceleration problems",
                "Interpret free-body diagrams",
            ],
        ),
        user="local-teacher",
    )
    with transaction() as s:
        u = s.get(Unit, result["id"])
        add_source(
            s,
            u,
            "Newton — teacher demonstration notes.txt",
            [(f"Section {i + 1}", t) for i, t in enumerate(SOURCE.split("\n"))],
            SOURCE.encode(),
        )
    gap(result["id"], user="local-teacher")
    tick()
    generate(result["id"], user="local-teacher")
    tick()
    print("Created explicitly labeled development demo:", result["id"])


if __name__ == "__main__":
    main()
