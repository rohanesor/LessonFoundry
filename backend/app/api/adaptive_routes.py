"""Adaptive Learning APIs — Learning plans and coding challenges.

Implements Requirements 2, 3, and 4 from the Adaptive Syllabus Coach specification.
"""

import os

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import student, teacher
from app.api.ratelimit import rate_limit
from app.database import transaction
from app.models.entities import (
    LearningPlan, PlanItem, CodingProblem, CodeSubmission,
    ClassroomMember, Unit, now,
)


router = APIRouter(prefix="/api")


# ─── Schemas ──────────────────────────────────────────────────────────────────

class GeneratePlanInput(BaseModel):
    classroom_id: str


class MarkCompleteInput(BaseModel):
    item_id: str


class CodeSubmitInput(BaseModel):
    code: str = Field(min_length=1, max_length=50000)
    language: str = Field(default="python", pattern="^(python)$")


class GenerateProblemInput(BaseModel):
    topic: str = Field(min_length=2, max_length=100)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    unit_id: str | None = None


def _student_problem(session, problem_id: str, student_id: str) -> CodingProblem:
    """Return only challenges attached to a published unit the student can access."""
    from sqlalchemy import select

    problem = session.get(CodingProblem, problem_id)
    if not problem or not problem.unit_id:
        raise HTTPException(404, "Problem not found")
    unit = session.get(Unit, problem.unit_id)
    if not unit or not unit.published_at or not unit.classroom_id:
        raise HTTPException(404, "Problem not found")
    member = session.scalar(select(ClassroomMember).where(
        ClassroomMember.user_id == student_id,
        ClassroomMember.classroom_id == unit.classroom_id,
        ClassroomMember.status == "active",
    ))
    if not member:
        raise HTTPException(404, "Problem not found")
    return problem


# ─── Learning Plans (Requirement 3) ──────────────────────────────────────────

@router.post("/student/learning-plans", status_code=201)
@rate_limit("learning-plan", capacity=5, refill_per_second=1/300)
def create_learning_plan(body: GeneratePlanInput, user=Depends(student)):
    """Generate a personalized 3-day learning plan based on weak topics."""
    with transaction() as s:
        # Verify enrollment
        from sqlalchemy import select
        member = s.scalar(
            select(ClassroomMember).where(
                ClassroomMember.user_id == user,
                ClassroomMember.classroom_id == body.classroom_id,
                ClassroomMember.status == "active",
            )
        )
        if not member:
            raise HTTPException(403, "Not enrolled in this classroom")
        
        # Check for existing active plan
        existing = s.scalar(
            select(LearningPlan).where(
                LearningPlan.student_id == user,
                LearningPlan.classroom_id == body.classroom_id,
                LearningPlan.status == "active",
            )
        )
        if existing:
            raise HTTPException(
                409, 
                "You already have an active learning plan. Complete or cancel it first."
            )
        
        from app.services.planner import AdaptivePlanner
        planner = AdaptivePlanner(s)
        
        try:
            result = planner.generate_plan(user, body.classroom_id)
            return {
                "plan_id": result.plan_id,
                "weak_topics": result.weak_topics,
                "days": [
                    {
                        "day": day.day_number,
                        "focus": day.focus_topic,
                        "activity_count": len(day.activities),
                    }
                    for day in result.days
                ],
            }
        except PermissionError as e:
            raise HTTPException(403, str(e))


@router.get("/student/learning-plans")
def list_learning_plans(
    classroom_id: str | None = None,
    status: str | None = None,
    user=Depends(student)
):
    """List student's learning plans."""
    with transaction() as s:
        from sqlalchemy import select
        
        query = select(LearningPlan).where(LearningPlan.student_id == user)
        
        if classroom_id:
            query = query.where(LearningPlan.classroom_id == classroom_id)
        if status:
            query = query.where(LearningPlan.status == status)
        
        query = query.order_by(LearningPlan.created_at.desc())
        
        plans = list(s.scalars(query))
        
        return [
            {
                "id": p.id,
                "classroom_id": p.classroom_id,
                "weak_topics": p.weak_topics,
                "status": p.status,
                "created_at": p.created_at,
                "completed_at": p.completed_at,
            }
            for p in plans
        ]


@router.get("/student/learning-plans/{plan_id}")
def get_learning_plan(plan_id: str, user=Depends(student)):
    """Get details of a specific learning plan."""
    with transaction() as s:
        from app.services.planner import AdaptivePlanner
        planner = AdaptivePlanner(s)
        
        plan = planner.get_plan(plan_id, user)
        if not plan:
            raise HTTPException(404, "Learning plan not found")
        
        return plan


@router.patch("/student/learning-plans/{plan_id}/items/{item_id}")
def mark_item_complete(plan_id: str, item_id: str, user=Depends(student)):
    """Mark a learning plan item as complete."""
    with transaction() as s:
        from app.services.planner import AdaptivePlanner
        planner = AdaptivePlanner(s)
        
        try:
            result = planner.mark_item_complete(item_id, user)
            return result
        except ValueError:
            raise HTTPException(404, "Item not found")
        except PermissionError:
            raise HTTPException(403, "Not authorized")


@router.delete("/student/learning-plans/{plan_id}")
def cancel_learning_plan(plan_id: str, user=Depends(student)):
    """Cancel an active learning plan."""
    with transaction() as s:
        plan = s.get(LearningPlan, plan_id)
        if not plan or plan.student_id != user:
            raise HTTPException(404, "Learning plan not found")
        
        if plan.status != "active":
            raise HTTPException(409, "Only active plans can be cancelled")
        
        plan.status = "cancelled"
        return {"cancelled": True}


# ─── Curriculum Retrieval (Requirement 2) ─────────────────────────────────────

@router.get("/student/remedial-content")
def get_remedial_content(
    classroom_id: str | None = None,
    user=Depends(student)
):
    """Get curriculum content matched to student's weak topics."""
    with transaction() as s:
        from app.services.curriculum import CurriculumRetrieval
        retrieval = CurriculumRetrieval(s)
        
        results = retrieval.get_content_for_student(user, classroom_id)
        
        return {
            "results": [
                {
                    "weak_topic": {
                        "objective_id": r.weak_topic.objective_id,
                        "description": r.weak_topic.description,
                        "accuracy": round(r.weak_topic.accuracy, 3),
                    },
                    "segments": [
                        {
                            "asset_version_id": seg.asset_version_id,
                            "slot": seg.slot,
                            "title": seg.title,
                            "difficulty": seg.difficulty,
                            "unit_title": seg.unit_title,
                        }
                        for seg in r.segments[:5]  # Limit segments per topic
                    ],
                }
                for r in results
            ]
        }


# ─── Coding Problems (Requirement 4) ──────────────────────────────────────────

@router.get("/student/problems")
def list_student_problems(classroom_id: str, user=Depends(student)):
    """List challenges attached to units in a classroom the student belongs to."""
    with transaction() as s:
        from sqlalchemy import select
        member = s.scalar(select(ClassroomMember).where(
            ClassroomMember.user_id == user,
            ClassroomMember.classroom_id == classroom_id,
            ClassroomMember.status == "active",
        ))
        if not member:
            raise HTTPException(403, "Not enrolled in this classroom")
        rows = s.execute(
            select(CodingProblem).join(Unit, CodingProblem.unit_id == Unit.id)
            .where(Unit.classroom_id == classroom_id, Unit.published_at.is_not(None))
            .order_by(CodingProblem.created_at.desc())
        ).scalars().all()
        return [{"id": p.id, "topic": p.topic, "difficulty": p.difficulty,
                 "title": p.title, "language": p.language} for p in rows]


@router.get("/student/problems/{problem_id}")
def get_problem(problem_id: str, user=Depends(student)):
    """Get a coding problem."""
    with transaction() as s:
        problem = _student_problem(s, problem_id, user)
        return {
            "id": problem.id,
            "topic": problem.topic,
            "difficulty": problem.difficulty,
            "title": problem.title,
            "description": problem.description,
            "starter_code": problem.starter_code,
            "hints": problem.hints,
            "language": problem.language,
            # Note: test_cases and solution are NOT returned to student
        }


@router.post("/student/problems/{problem_id}/submit")
@rate_limit("code-submit", capacity=10, refill_per_second=1/10)
def submit_code(problem_id: str, body: CodeSubmitInput, user=Depends(student)):
    """Submit code for local development feedback only."""
    if (
        os.getenv("AUTH_MODE", "local").lower() == "supabase"
        or os.getenv("APP_ENV", "development").lower() in {"staging", "production"}
    ):
        raise HTTPException(
            503,
            "Code execution is disabled until a hardened sandbox is configured.",
        )
    with transaction() as s:
        problem = _student_problem(s, problem_id, user)
        
        # Development-only host subprocess; hosted modes are blocked above.
        from app.services.sandbox import CodeSandbox
        sandbox = CodeSandbox()
        
        result = sandbox.evaluate(
            code=body.code,
            test_cases=problem.test_cases,
            problem_title=problem.title,
        )
        
        # Store submission
        submission = CodeSubmission(
            problem_id=problem_id,
            student_id=user,
            code=body.code,
            language=body.language,
            status=result.status,
            stdout=result.stdout,
            stderr=result.stderr,
            test_results=[
                {
                    "name": t.name,
                    "passed": t.passed,
                    "expected": t.expected,
                    "actual": t.actual,
                }
                for t in result.test_results
            ],
            feedback=result.feedback,
            execution_time_ms=result.execution_time_ms,
        )
        s.add(submission)
        s.flush()
        
        return {
            "submission_id": submission.id,
            "status": result.status,
            "passed_count": result.passed_count,
            "total_count": result.total_count,
            "feedback": result.feedback,
            "execution_time_ms": result.execution_time_ms,
            "test_results": [
                {
                    "name": t.name,
                    "passed": t.passed,
                    # Only show expected/actual for failed tests
                    "expected": t.expected if not t.passed else None,
                    "actual": t.actual if not t.passed else None,
                }
                for t in result.test_results
            ],
        }


@router.get("/student/submissions")
def list_submissions(
    problem_id: str | None = None,
    limit: int = 20,
    user=Depends(student)
):
    """List student's code submissions."""
    with transaction() as s:
        from sqlalchemy import select
        
        query = (
            select(CodeSubmission)
            .where(CodeSubmission.student_id == user)
            .order_by(CodeSubmission.submitted_at.desc())
            .limit(min(limit, 50))
        )
        
        if problem_id:
            query = query.where(CodeSubmission.problem_id == problem_id)
        
        submissions = list(s.scalars(query))
        
        return [
            {
                "id": sub.id,
                "problem_id": sub.problem_id,
                "status": sub.status,
                "feedback": sub.feedback,
                "execution_time_ms": sub.execution_time_ms,
                "submitted_at": sub.submitted_at,
            }
            for sub in submissions
        ]


@router.get("/student/submissions/{submission_id}")
def get_submission(submission_id: str, user=Depends(student)):
    """Get details of a specific submission."""
    with transaction() as s:
        submission = s.get(CodeSubmission, submission_id)
        if not submission or submission.student_id != user:
            raise HTTPException(404, "Submission not found")
        
        return {
            "id": submission.id,
            "problem_id": submission.problem_id,
            "code": submission.code,
            "language": submission.language,
            "status": submission.status,
            "stdout": submission.stdout,
            "stderr": submission.stderr,
            "test_results": submission.test_results,
            "feedback": submission.feedback,
            "execution_time_ms": submission.execution_time_ms,
            "submitted_at": submission.submitted_at,
        }


# ─── Teacher: Problem Generation ──────────────────────────────────────────────

@router.post("/teacher/problems", status_code=201)
def create_coding_problem(body: GenerateProblemInput, user=Depends(teacher)):
    """Create a coding problem (teacher only)."""
    with transaction() as s:
        # A teacher may keep an unlinked draft in their library, but student APIs
        # expose only challenges explicitly attached to an owned classroom unit.
        if body.unit_id:
            unit = s.get(Unit, body.unit_id)
            if not unit or unit.owner_id != user or not unit.classroom_id:
                raise HTTPException(404, "Classroom learning pack not found")
        # For now, create a template problem; generated content still needs review.
        problem = CodingProblem(
            unit_id=body.unit_id,
            topic=body.topic,
            difficulty=body.difficulty,
            title=f"{body.topic.title()} Challenge",
            description=f"Solve this {body.difficulty} problem about {body.topic}.",
            starter_code="# Write your solution here\n",
            test_cases=[
                {"name": "Test 1", "input": "", "expected": ""},
            ],
            solution="# Solution goes here",
            hints=[],
            language="python",
        )
        s.add(problem)
        s.flush()
        
        return {
            "id": problem.id,
            "topic": problem.topic,
            "difficulty": problem.difficulty,
            "title": problem.title,
        }


@router.get("/teacher/problems")
def list_problems(
    topic: str | None = None,
    difficulty: str | None = None,
    user=Depends(teacher)
):
    """List available coding problems."""
    with transaction() as s:
        from sqlalchemy import select
        
        query = select(CodingProblem).order_by(CodingProblem.created_at.desc())
        
        if topic:
            query = query.where(CodingProblem.topic.ilike(f"%{topic}%"))
        if difficulty:
            query = query.where(CodingProblem.difficulty == difficulty)
        
        problems = list(s.scalars(query.limit(50)))
        
        return [
            {
                "id": p.id,
                "topic": p.topic,
                "difficulty": p.difficulty,
                "title": p.title,
                "language": p.language,
                "created_at": p.created_at,
            }
            for p in problems
        ]
