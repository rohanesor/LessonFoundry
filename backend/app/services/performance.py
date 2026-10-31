"""Performance Analyzer — Identifies weak topics from student quiz history.

This service implements Requirement 1: Read weak topics from test scores.
"""

from collections import defaultdict
from dataclasses import dataclass
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.entities import (
    QuizAttempt, Objective, Unit, ClassroomMember, AssetVersion
)


@dataclass
class TopicPerformance:
    """Performance metrics for a single topic/objective."""
    objective_id: str
    description: str
    topic_tags: list[str]
    total_attempts: int
    correct_attempts: int
    accuracy: float
    unit_id: str
    unit_title: str
    
    @property
    def is_weak(self) -> bool:
        """Topic is considered weak if accuracy < 70% with at least 2 attempts."""
        return self.accuracy < 0.7 and self.total_attempts >= 2


@dataclass
class PerformanceReport:
    """Complete performance report for a student."""
    student_id: str
    total_attempts: int
    overall_accuracy: float
    weak_topics: list[TopicPerformance]
    strong_topics: list[TopicPerformance]
    all_topics: list[TopicPerformance]


class PerformanceAnalyzer:
    """Analyzes student quiz performance to identify weak topics."""
    
    WEAK_THRESHOLD = 0.7  # Below 70% accuracy is considered weak
    MIN_ATTEMPTS = 2      # Need at least 2 attempts to evaluate
    
    def __init__(self, session: Session):
        self.session = session
    
    def get_student_performance(
        self, 
        student_id: str, 
        classroom_id: str | None = None
    ) -> PerformanceReport:
        """
        Analyze a student's quiz performance across all their classrooms
        or a specific classroom.
        
        Returns weak and strong topics based on quiz accuracy.
        """
        # Build base query for student's attempts
        query = select(QuizAttempt).where(QuizAttempt.student_id == student_id)
        
        if classroom_id:
            query = query.where(QuizAttempt.classroom_id == classroom_id)
        
        attempts = list(self.session.scalars(query))
        
        if not attempts:
            return PerformanceReport(
                student_id=student_id,
                total_attempts=0,
                overall_accuracy=0.0,
                weak_topics=[],
                strong_topics=[],
                all_topics=[],
            )
        
        # Group attempts by objective
        by_objective: dict[str, list[QuizAttempt]] = defaultdict(list)
        for attempt in attempts:
            if attempt.objective_id:
                by_objective[attempt.objective_id].append(attempt)
        
        # Calculate per-topic metrics
        all_topics: list[TopicPerformance] = []
        
        for objective_id, obj_attempts in by_objective.items():
            objective = self.session.get(Objective, objective_id)
            if not objective:
                continue
            
            unit = self.session.get(Unit, objective.unit_id)
            if not unit:
                continue
            
            total = len(obj_attempts)
            correct = sum(1 for a in obj_attempts if a.is_correct)
            accuracy = correct / total if total > 0 else 0.0
            
            topic = TopicPerformance(
                objective_id=objective_id,
                description=objective.description,
                topic_tags=objective.topic_tags or [],
                total_attempts=total,
                correct_attempts=correct,
                accuracy=accuracy,
                unit_id=unit.id,
                unit_title=unit.title,
            )
            all_topics.append(topic)
        
        # Sort by accuracy (weakest first)
        all_topics.sort(key=lambda t: t.accuracy)
        
        # Categorize topics
        weak_topics = [t for t in all_topics if t.is_weak]
        strong_topics = [t for t in all_topics if not t.is_weak and t.total_attempts >= self.MIN_ATTEMPTS]
        
        # Calculate overall stats
        total_attempts = len(attempts)
        correct_attempts = sum(1 for a in attempts if a.is_correct)
        overall_accuracy = correct_attempts / total_attempts if total_attempts > 0 else 0.0
        
        return PerformanceReport(
            student_id=student_id,
            total_attempts=total_attempts,
            overall_accuracy=overall_accuracy,
            weak_topics=weak_topics,
            strong_topics=strong_topics,
            all_topics=all_topics,
        )
    
    def get_classroom_analytics(
        self, 
        classroom_id: str, 
        owner_id: str
    ) -> dict:
        """
        Get aggregate performance analytics for a classroom (teacher view).
        
        Returns common weak topics across students.
        """
        # Verify ownership
        from app.models.entities import Classroom
        classroom = self.session.get(Classroom, classroom_id)
        if not classroom or classroom.owner_id != owner_id:
            raise PermissionError("Not authorized to view this classroom")
        
        # Get all members
        members = list(self.session.scalars(
            select(ClassroomMember)
            .where(
                ClassroomMember.classroom_id == classroom_id,
                ClassroomMember.status == "active",
            )
        ))
        
        if not members:
            return {
                "classroom_id": classroom_id,
                "student_count": 0,
                "total_attempts": 0,
                "average_accuracy": 0.0,
                "common_weak_topics": [],
            }
        
        # Aggregate all attempts in this classroom
        attempts = list(self.session.scalars(
            select(QuizAttempt).where(QuizAttempt.classroom_id == classroom_id)
        ))
        
        total_attempts = len(attempts)
        correct_attempts = sum(1 for a in attempts if a.is_correct)
        average_accuracy = correct_attempts / total_attempts if total_attempts > 0 else 0.0
        
        # Count weak occurrences per objective across students
        objective_weakness: dict[str, int] = defaultdict(int)
        
        for member in members:
            report = self.get_student_performance(member.user_id, classroom_id)
            for topic in report.weak_topics:
                objective_weakness[topic.objective_id] += 1
        
        # Find common weak topics (weak for multiple students)
        common_weak = []
        for objective_id, weak_count in objective_weakness.items():
            if weak_count >= 2:  # At least 2 students struggle with this
                objective = self.session.get(Objective, objective_id)
                unit = self.session.get(Unit, objective.unit_id) if objective else None
                if objective and unit:
                    common_weak.append({
                        "objective_id": objective_id,
                        "description": objective.description,
                        "topic_tags": objective.topic_tags or [],
                        "students_struggling": weak_count,
                        "unit_id": unit.id,
                        "unit_title": unit.title,
                    })
        
        common_weak.sort(key=lambda t: t["students_struggling"], reverse=True)
        
        return {
            "classroom_id": classroom_id,
            "student_count": len(members),
            "total_attempts": total_attempts,
            "average_accuracy": average_accuracy,
            "common_weak_topics": common_weak[:10],  # Top 10
        }
