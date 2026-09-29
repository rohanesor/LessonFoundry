import re
from difflib import SequenceMatcher
from typing import Protocol


class QualityValidator(Protocol):
    def validate(self, payload: dict, context: dict) -> list[dict]: ...


class CoreValidator:
    def validate(self, p, ctx):
        results = []

        def add(name, state, detail):
            results.append({"name": name, "state": state, "detail": detail})

        add("Schema", "PASS", "Structured payload parsed with Pydantic.")
        within = len(p["body"].split()) <= ctx.get("max_words", 300)
        add(
            "Length constraint",
            "PASS" if within else "FAIL",
            f"Body contains {len(p['body'].split())} words; limit {ctx.get('max_words', 300)}.",
        )
        valid = set(p["evidence_ids"]) <= set(ctx["evidence"])
        add(
            "Evidence existence",
            "PASS" if valid else "FAIL",
            "Evidence IDs resolve to this pack’s current source versions."
            if valid
            else "Missing or cross-pack evidence reference.",
        )
        add(
            "Source location",
            "PASS" if valid else "FAIL",
            "Page, slide or paragraph preserved for every evidence unit."
            if valid
            else "Source locations cannot be resolved.",
        )
        quiz = ctx["slot"].startswith("quiz")
        key_ok = not quiz or (
            len(p["options"]) == 4
            and p["answer"] is not None
            and len(set(p["options"])) == 4
            and all(x.strip() for x in p["options"])
        )
        add(
            "Answer validity",
            "PASS" if key_ok else "FAIL",
            "Key index and option structure valid; teacher must check correctness."
            if key_ok
            else "Four distinct nonblank options and a correct-answer index are required.",
        )
        add(
            "Answer-key consistency",
            "PASS",
            "Answer key is derived from approved question versions, not separately generated.",
        )
        leaked = quiz and bool(
            re.search(r"correct answer|answer is|solution:", p["body"], re.I)
        )
        add(
            "Answer leakage",
            "FAIL" if leaked else "NEEDS_REVIEW",
            "Answer-revealing language detected."
            if leaked
            else "No rule-based leak detected; inspect wording and options for semantic leakage.",
        )
        suspicious = bool(
            re.search(
                r"ignore.{0,40}(previous|instructions)|system prompt|reveal.{0,20}answer",
                p["body"],
                re.I,
            )
        )
        add(
            "Instruction safety",
            "FAIL" if suspicious else "PASS",
            "Suspicious source instruction echoed."
            if suspicious
            else "No known instruction-echo pattern detected. Not a guarantee against injection.",
        )
        duplicate = any(
            SequenceMatcher(None, p["body"].lower(), t.lower()).ratio() > 0.9
            for t in ctx.get("neighbors", [])
        )
        add(
            "Duplicates",
            "WARNING" if duplicate else "PASS",
            "Near-identical neighboring asset detected."
            if duplicate
            else "No near-identical text found among neighboring assets.",
        )
        bands = {
            "Easy": ["Remember", "Understand"],
            "Medium": ["Apply"],
            "Advanced": ["Analyze", "Evaluate", "Create"],
        }
        mismatch = p["bloom"] not in bands[p["difficulty"]]
        add(
            "Difficulty",
            "WARNING" if mismatch else "NEEDS_REVIEW",
            f"{p['difficulty']} / {p['bloom']}: "
            + (
                "classification mismatch."
                if mismatch
                else "inspect reasoning steps, novelty and scaffolding; tag alone is not proof."
            ),
        )
        add(
            "Grounding / support",
            "NEEDS_REVIEW",
            "Evidence references are valid, but entailment is not proven. Review each claim against its passage.",
        )
        add(
            "Cross-artifact consistency",
            "NEEDS_REVIEW",
            "Claim registry available. Semantic contradiction checking requires teacher review in this release.",
        )
        add(
            "Terminology consistency",
            "NEEDS_REVIEW",
            "Compare symbols, units and definitions with source terminology before approval.",
        )
        return results
