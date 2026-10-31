"""Adaptive Planner — Generates personalized 3-day learning plans.

This service implements Requirement 3: Build a 3-day remedial schedule.
"""

from dataclasses import dataclass
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    LearningPlan, PlanItem, ClassroomMember, Unit, now
)
from app.services.performance import PerformanceAnalyzer, TopicPerformance
from app.services.curriculum import CurriculumRetrieval, CurriculumSegment


@dataclass
class DayPlan:
    """Activities for a single day."""
    day_number: int
    focus_topic: str
    activities: list[dict]


@dataclass
class GeneratedPlan:
    """A complete 3-day learning plan."""
    plan_id: str
    student_id: str
    classroom_id: str
    weak_topics: list[dict]
    days: list[DayPlan]


class AdaptivePlanner:
    """Generates personalized learning plans based on student weaknesses."""
    
    ACTIVITIES_PER_DAY = 4
    
    def __init__(self, session: Session):
        self.session = session
        self.performance = PerformanceAnalyzer(session)
        self.curriculum = CurriculumRetrieval(session)
    
    def generate_plan(
        self,
        student_id: str,
        classroom_id: str,
    ) -> GeneratedPlan:
        """
        Generate a 3-day learning plan for a student in a classroom.
        
        Day 1: Foundational review of weak concepts
        Day 2: Practice exercises and examples
        Day 3: Assessment and synthesis
        """
        # Verify enrollment
        member = self.session.scalar(
            select(ClassroomMember).where(
                ClassroomMember.user_id == student_id,
                ClassroomMember.classroom_id == classroom_id,
                ClassroomMember.status == "active",
            )
        )
        if not member:
            raise PermissionError("Student is not enrolled in this classroom")
        
        # Analyze performance
        report = self.performance.get_student_performance(student_id, classroom_id)
        weak_topics = report.weak_topics[:3]  # Focus on top 3 weakest
        
        if not weak_topics:
            # No weak topics - create a general review plan
            weak_topics = report.all_topics[:3] if report.all_topics else []
        
        # Get remedial content
        curriculum_results = self.curriculum.get_remedial_content(
            weak_topics, student_id
        )
        
        # Create the plan
        plan = LearningPlan(
            student_id=student_id,
            classroom_id=classroom_id,
            weak_topics=[
                {
                    "objective_id": t.objective_id,
                    "description": t.description,
                    "accuracy": t.accuracy,
                    "topic_tags": t.topic_tags,
                }
                for t in weak_topics
            ],
            status="active",
        )
        self.session.add(plan)
        self.session.flush()
        
        # Generate activities for each day
        days = []
        
        # Day 1: Foundational Review
        day1_activities = self._generate_day1_activities(
            weak_topics, curriculum_results, plan.id
        )
        days.append(DayPlan(
            day_number=1,
            focus_topic="Understanding Core Concepts",
            activities=day1_activities,
        ))
        
        # Day 2: Practice and Examples
        day2_activities = self._generate_day2_activities(
            weak_topics, curriculum_results, plan.id
        )
        days.append(DayPlan(
            day_number=2,
            focus_topic="Practice and Application",
            activities=day2_activities,
        ))
        
        # Day 3: Assessment and Synthesis
        day3_activities = self._generate_day3_activities(
            weak_topics, curriculum_results, plan.id
        )
        days.append(DayPlan(
            day_number=3,
            focus_topic="Assessment and Mastery",
            activities=day3_activities,
        ))
        
        return GeneratedPlan(
            plan_id=plan.id,
            student_id=student_id,
            classroom_id=classroom_id,
            weak_topics=[
                {
                    "objective_id": t.objective_id,
                    "description": t.description,
                    "accuracy": round(t.accuracy, 3),
                }
                for t in weak_topics
            ],
            days=days,
        )
    
    def _generate_day1_activities(
        self,
        weak_topics: list[TopicPerformance],
        curriculum_results: list,
        plan_id: str,
    ) -> list[dict]:
        """Day 1: Focus on understanding concepts through explanations."""
        activities = []
        position = 0
        
        for i, topic in enumerate(weak_topics):
            # Find explanation content for this topic
            explanation = None
            for result in curriculum_results:
                if result.weak_topic.objective_id == topic.objective_id:
                    for seg in result.segments:
                        if seg.slot == "explanation":
                            explanation = seg
                            break
                    break
            
            # Activity: Review explanation
            position += 1
            item = PlanItem(
                plan_id=plan_id,
                day_number=1,
                position=position,
                activity_type="review",
                title=f"Review: {topic.description[:80]}",
                description=f"Read through the explanation material and take notes on key concepts.",
                asset_version_id=explanation.asset_version_id if explanation else None,
                estimated_minutes=15,
            )
            self.session.add(item)
            activities.append({
                "position": position,
                "type": "review",
                "title": item.title,
                "estimated_minutes": 15,
            })
            
            # Activity: Self-check
            if i < 2:  # Only for first 2 topics
                position += 1
                item = PlanItem(
                    plan_id=plan_id,
                    day_number=1,
                    position=position,
                    activity_type="reflection",
                    title=f"Self-Check: {topic.description[:60]}",
                    description="Can you explain this concept in your own words? Write a brief summary.",
                    estimated_minutes=10,
                )
                self.session.add(item)
                activities.append({
                    "position": position,
                    "type": "reflection",
                    "title": item.title,
                    "estimated_minutes": 10,
                })
        
        return activities
    
    def _generate_day2_activities(
        self,
        weak_topics: list[TopicPerformance],
        curriculum_results: list,
        plan_id: str,
    ) -> list[dict]:
        """Day 2: Practice with exercises and examples."""
        activities = []
        position = 0
        
        for topic in weak_topics:
            # Find practice content
            practice_content = []
            for result in curriculum_results:
                if result.weak_topic.objective_id == topic.objective_id:
                    for seg in result.segments:
                        if seg.slot in ["assessment_easy", "assessment_medium"]:
                            practice_content.append(seg)
                    break
            
            # Activity: Worked examples
            position += 1
            item = PlanItem(
                plan_id=plan_id,
                day_number=2,
                position=position,
                activity_type="practice",
                title=f"Practice: {topic.description[:70]}",
                description="Work through these practice problems. Check your answers before moving on.",
                asset_version_id=practice_content[0].asset_version_id if practice_content else None,
                estimated_minutes=20,
            )
            self.session.add(item)
            activities.append({
                "position": position,
                "type": "practice",
                "title": item.title,
                "estimated_minutes": 20,
            })
        
        # Add a coding activity if applicable
        position += 1
        item = PlanItem(
            plan_id=plan_id,
            day_number=2,
            position=position,
            activity_type="coding",
            title="Coding Challenge",
            description="Apply your understanding to solve a programming problem related to these concepts.",
            estimated_minutes=25,
        )
        self.session.add(item)
        activities.append({
            "position": position,
            "type": "coding",
            "title": item.title,
            "estimated_minutes": 25,
        })
        
        return activities
    
    def _generate_day3_activities(
        self,
        weak_topics: list[TopicPerformance],
        curriculum_results: list,
        plan_id: str,
    ) -> list[dict]:
        """Day 3: Assessment and mastery check."""
        activities = []
        position = 0
        
        # Activity: Quick review
        position += 1
        topic_names = ", ".join(t.description[:30] for t in weak_topics[:2])
        item = PlanItem(
            plan_id=plan_id,
            day_number=3,
            position=position,
            activity_type="review",
            title="Quick Review",
            description=f"Briefly review the key concepts: {topic_names}",
            estimated_minutes=10,
        )
        self.session.add(item)
        activities.append({
            "position": position,
            "type": "review",
            "title": item.title,
            "estimated_minutes": 10,
        })
        
        # Activity: Assessment quiz
        position += 1
        item = PlanItem(
            plan_id=plan_id,
            day_number=3,
            position=position,
            activity_type="assessment",
            title="Mastery Assessment",
            description="Take this quiz to test your understanding. Aim for at least 70% accuracy.",
            estimated_minutes=15,
        )
        self.session.add(item)
        activities.append({
            "position": position,
            "type": "assessment",
            "title": item.title,
            "estimated_minutes": 15,
        })
        
        # Activity: Final coding challenge
        position += 1
        item = PlanItem(
            plan_id=plan_id,
            day_number=3,
            position=position,
            activity_type="coding",
            title="Integration Challenge",
            description="Complete this coding problem that combines multiple concepts you've learned.",
            estimated_minutes=30,
        )
        self.session.add(item)
        activities.append({
            "position": position,
            "type": "coding",
            "title": item.title,
            "estimated_minutes": 30,
        })
        
        # Activity: Reflection
        position += 1
        item = PlanItem(
            plan_id=plan_id,
            day_number=3,
            position=position,
            activity_type="reflection",
            title="Progress Reflection",
            description="Write down what you've learned and any remaining questions.",
            estimated_minutes=10,
        )
        self.session.add(item)
        activities.append({
            "position": position,
            "type": "reflection",
            "title": item.title,
            "estimated_minutes": 10,
        })
        
        return activities
    
    def get_plan(self, plan_id: str, student_id: str) -> dict | None:
        """Retrieve a learning plan with all its items."""
        plan = self.session.get(LearningPlan, plan_id)
        if not plan or plan.student_id != student_id:
            return None
        
        items = list(self.session.scalars(
            select(PlanItem)
            .where(PlanItem.plan_id == plan_id)
            .order_by(PlanItem.day_number, PlanItem.position)
        ))
        
        # Group by day
        days = {1: [], 2: [], 3: []}
        for item in items:
            days[item.day_number].append({
                "id": item.id,
                "position": item.position,
                "type": item.activity_type,
                "title": item.title,
                "description": item.description,
                "asset_version_id": item.asset_version_id,
                "coding_problem_id": item.coding_problem_id,
                "estimated_minutes": item.estimated_minutes,
                "completed": item.completed,
                "completed_at": item.completed_at,
            })
        
        # Calculate progress
        total_items = len(items)
        completed_items = sum(1 for i in items if i.completed)
        
        return {
            "id": plan.id,
            "student_id": plan.student_id,
            "classroom_id": plan.classroom_id,
            "weak_topics": plan.weak_topics,
            "status": plan.status,
            "created_at": plan.created_at,
            "completed_at": plan.completed_at,
            "progress": {
                "total": total_items,
                "completed": completed_items,
                "percentage": round(completed_items / total_items * 100) if total_items else 0,
            },
            "days": [
                {"day": i, "focus": self._day_focus(i), "activities": days[i]}
                for i in [1, 2, 3]
            ],
        }
    
    def _day_focus(self, day: int) -> str:
        return {
            1: "Understanding Core Concepts",
            2: "Practice and Application",
            3: "Assessment and Mastery",
        }.get(day, "Learning")
    
    def mark_item_complete(
        self,
        item_id: str,
        student_id: str,
    ) -> dict:
        """Mark a plan item as complete."""
        item = self.session.get(PlanItem, item_id)
        if not item:
            raise ValueError("Item not found")
        
        plan = self.session.get(LearningPlan, item.plan_id)
        if not plan or plan.student_id != student_id:
            raise PermissionError("Not authorized")
        
        item.completed = True
        item.completed_at = now()
        
        # Check if entire plan is complete
        all_items = list(self.session.scalars(
            select(PlanItem).where(PlanItem.plan_id == plan.id)
        ))
        if all(i.completed for i in all_items):
            plan.status = "completed"
            plan.completed_at = now()
        
        return {
            "item_id": item.id,
            "completed": True,
            "plan_status": plan.status,
        }
