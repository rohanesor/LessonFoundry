"""Teacher-authored Newton quiz fixture. Only used for explicitly labeled demo packs.

Not a model fallback and never used when source passages cannot be resolved.
"""

QUESTIONS = [
    {
        "marker": "Newton's first law:",
        "question": "An object moves in a straight line at constant velocity. What is its resultant external force?",
        "options": [
            "Zero",
            "A constant force in the direction of motion",
            "A force proportional to its velocity",
            "A force that increases with time",
        ],
        "solution": "Zero resultant external force is consistent with constant velocity in an inertial frame, as stated by the first law.",
        "bloom": "Understand",
        "difficulty": "Easy",
    },
    {
        "marker": "Newton's second law:",
        "question": "A 2 kg object accelerates at 3 m/s². What is the resultant force?",
        "options": ["6 N", "1.5 N", "5 N", "9 N"],
        "solution": "F = ma = 2 kg × 3 m/s² = 6 N. Use resultant force, not an arbitrary individual force.",
        "bloom": "Apply",
        "difficulty": "Medium",
    },
    {
        "marker": "Newton's third law:",
        "question": "A student says action and reaction forces cancel, so neither interacting body can accelerate. Which explanation identifies the error?",
        "options": [
            "The two forces act on different bodies; acceleration depends on the resultant force on each body.",
            "The reaction force is always smaller than the action force.",
            "The reaction force occurs only after the action force disappears.",
            "Equal forces always imply that both bodies remain at rest.",
        ],
        "solution": "First identify the body being analyzed. An action–reaction pair acts on two different bodies, so the pair does not cancel in a single-body free-body diagram. Then consider all external forces on that body.",
        "bloom": "Analyze",
        "difficulty": "Advanced",
    },
    {
        "marker": "A free-body diagram shows",
        "question": "A book rests on a horizontal table with no other vertical forces. Which forces balance on the book?",
        "options": [
            "The upward normal force and downward weight",
            "Two downward forces",
            "The force of the book on the table and the weight of the book",
            "No forces act on the book",
        ],
        "solution": "The chosen body is the book. Its upward normal force balances its downward weight when it is at rest with no other vertical forces.",
        "bloom": "Apply",
        "difficulty": "Medium",
    },
    {
        "marker": "Newton's first law:",
        "question": "Which physical quantity measures inertia?",
        "options": ["Mass", "Velocity", "Acceleration", "Resultant force"],
        "solution": "Mass measures inertia, the resistance to a change in velocity.",
        "bloom": "Remember",
        "difficulty": "Easy",
    },
]


def fixture(slot, request):
    if request["contract"].get("demo_fixture") != "newton" or not slot.startswith(
        "quiz"
    ):
        return None
    q = QUESTIONS[int(slot[4:]) - 1]
    evidence = next(
        (
            e
            for e in request["evidence"]
            if q["marker"] in e["text"]
            and e["hash"] == request["contract"].get("demo_source_hash")
        ),
        None,
    )
    if not evidence:
        return None
    index = int(slot[4:])
    objective = request["objectives"][0]
    # Preserve a target objective on regeneration; initial selection is source-aware.
    if len(request["objectives"]) > 1:
        terms = (
            ["force", "acceleration"]
            if index == 2
            else ["free-body"]
            if index == 4
            else ["laws"]
        )
        objective = next(
            (
                o
                for o in request["objectives"]
                if any(t in o["description"].lower() for t in terms)
            ),
            objective,
        )
    shift = request.get("variant", 0) % 4
    opts = q["options"][shift:] + q["options"][:shift]
    return dict(
        slot=slot,
        objective_id=objective["id"],
        title=f"Question {index}",
        body=q["question"],
        options=opts,
        answer=(-shift) % 4,
        solution=q["solution"],
        difficulty=q["difficulty"],
        bloom=q["bloom"],
        evidence_ids=[evidence["id"]],
        claims=[q["solution"]],
    )
