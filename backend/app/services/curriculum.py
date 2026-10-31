"""Curriculum Retrieval — Maps weak topics to relevant learning materials.

This service implements Requirement 2: Retrieve matching curriculum segments.
"""

from dataclasses import dataclass
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    Objective, Unit, Asset, AssetVersion, ClassroomMember
)
from app.services.performance import TopicPerformance


@dataclass
class CurriculumSegment:
    """A piece of approved curriculum content for remediation."""
    asset_version_id: str
    slot: str
    title: str
    body: str
    difficulty: str
    objective_id: str
    objective_description: str
    unit_id: str
    unit_title: str
    topic_tags: list[str]


@dataclass
class CurriculumResult:
    """Result of curriculum retrieval for weak topics."""
    weak_topic: TopicPerformance
    segments: list[CurriculumSegment]


class CurriculumRetrieval:
    """Retrieves relevant curriculum content based on student weaknesses."""
    
    def __init__(self, session: Session):
        self.session = session
    
    def get_remedial_content(
        self,
        weak_topics: list[TopicPerformance],
        student_id: str,
    ) -> list[CurriculumResult]:
        """
        Retrieve approved curriculum content that addresses the given weak topics.
        
        Only returns content from classrooms the student is enrolled in.
        """
        if not weak_topics:
            return []
        
        # Get student's enrolled classrooms
        enrolled_classroom_ids = set(
            self.session.scalars(
                select(ClassroomMember.classroom_id)
                .where(
                    ClassroomMember.user_id == student_id,
                    ClassroomMember.status == "active",
                )
            )
        )
        
        if not enrolled_classroom_ids:
            return []
        
        results = []
        
        for topic in weak_topics:
            segments = self._find_segments_for_topic(
                topic, enrolled_classroom_ids
            )
            results.append(CurriculumResult(
                weak_topic=topic,
                segments=segments,
            ))
        
        return results
    
    def _find_segments_for_topic(
        self,
        topic: TopicPerformance,
        enrolled_classroom_ids: set[str],
    ) -> list[CurriculumSegment]:
        """Find curriculum segments matching a topic."""
        segments = []
        
        # Strategy 1: Find content from the same objective
        segments.extend(
            self._get_objective_content(topic.objective_id, enrolled_classroom_ids)
        )
        
        # Strategy 2: Find content with matching topic tags
        if topic.topic_tags:
            segments.extend(
                self._get_tagged_content(topic.topic_tags, enrolled_classroom_ids, topic.objective_id)
            )
        
        # Strategy 3: Find content from the same unit
        segments.extend(
            self._get_unit_content(topic.unit_id, enrolled_classroom_ids, topic.objective_id)
        )
        
        # Deduplicate by asset_version_id
        seen = set()
        unique_segments = []
        for seg in segments:
            if seg.asset_version_id not in seen:
                seen.add(seg.asset_version_id)
                unique_segments.append(seg)
        
        return unique_segments
    
    def _get_objective_content(
        self,
        objective_id: str,
        enrolled_classroom_ids: set[str],
    ) -> list[CurriculumSegment]:
        """Get approved content linked to a specific objective."""
        objective = self.session.get(Objective, objective_id)
        if not objective:
            return []
        
        unit = self.session.get(Unit, objective.unit_id)
        if not unit or unit.classroom_id not in enrolled_classroom_ids:
            return []
        
        if not unit.published_at:
            return []
        
        segments = []
        
        # Find approved asset versions for this objective
        asset_versions = self.session.execute(
            select(Asset, AssetVersion)
            .join(AssetVersion, AssetVersion.asset_id == Asset.id)
            .where(
                Asset.unit_id == unit.id,
                AssetVersion.objective_id == objective_id,
                AssetVersion.state == "APPROVED",
                AssetVersion.number == Asset.published_number,
            )
        )
        
        for asset, version in asset_versions:
            # Skip quiz questions for explanation content
            if asset.slot.startswith("quiz"):
                continue
            
            payload = version.payload
            segments.append(CurriculumSegment(
                asset_version_id=version.id,
                slot=asset.slot,
                title=payload.get("title", ""),
                body=payload.get("body", ""),
                difficulty=payload.get("difficulty", "Medium"),
                objective_id=objective_id,
                objective_description=objective.description,
                unit_id=unit.id,
                unit_title=unit.title,
                topic_tags=objective.topic_tags or [],
            ))
        
        return segments
    
    def _get_tagged_content(
        self,
        tags: list[str],
        enrolled_classroom_ids: set[str],
        exclude_objective_id: str,
    ) -> list[CurriculumSegment]:
        """Find content from other objectives with matching tags."""
        if not tags:
            return []
        
        segments = []
        
        # Find objectives with overlapping tags
        all_objectives = list(self.session.scalars(select(Objective)))
        
        for objective in all_objectives:
            if objective.id == exclude_objective_id:
                continue
            
            obj_tags = set(objective.topic_tags or [])
            if not obj_tags.intersection(set(tags)):
                continue
            
            unit = self.session.get(Unit, objective.unit_id)
            if not unit or unit.classroom_id not in enrolled_classroom_ids:
                continue
            if not unit.published_at:
                continue
            
            # Get explanation content for this objective
            asset_versions = self.session.execute(
                select(Asset, AssetVersion)
                .join(AssetVersion, AssetVersion.asset_id == Asset.id)
                .where(
                    Asset.unit_id == unit.id,
                    AssetVersion.objective_id == objective.id,
                    AssetVersion.state == "APPROVED",
                    AssetVersion.number == Asset.published_number,
                    Asset.slot == "explanation",
                )
            )
            
            for asset, version in asset_versions:
                payload = version.payload
                segments.append(CurriculumSegment(
                    asset_version_id=version.id,
                    slot=asset.slot,
                    title=payload.get("title", ""),
                    body=payload.get("body", ""),
                    difficulty=payload.get("difficulty", "Medium"),
                    objective_id=objective.id,
                    objective_description=objective.description,
                    unit_id=unit.id,
                    unit_title=unit.title,
                    topic_tags=objective.topic_tags or [],
                ))
        
        return segments
    
    def _get_unit_content(
        self,
        unit_id: str,
        enrolled_classroom_ids: set[str],
        exclude_objective_id: str,
    ) -> list[CurriculumSegment]:
        """Get other content from the same unit."""
        unit = self.session.get(Unit, unit_id)
        if not unit or unit.classroom_id not in enrolled_classroom_ids:
            return []
        if not unit.published_at:
            return []
        
        segments = []
        
        # Get assessment questions (not the same quiz they failed)
        asset_versions = self.session.execute(
            select(Asset, AssetVersion)
            .join(AssetVersion, AssetVersion.asset_id == Asset.id)
            .where(
                Asset.unit_id == unit.id,
                AssetVersion.state == "APPROVED",
                AssetVersion.number == Asset.published_number,
                AssetVersion.objective_id != exclude_objective_id,
                Asset.slot.in_(["assessment_easy", "assessment_medium"]),
            )
        )
        
        for asset, version in asset_versions:
            objective = self.session.get(Objective, version.objective_id)
            payload = version.payload
            segments.append(CurriculumSegment(
                asset_version_id=version.id,
                slot=asset.slot,
                title=payload.get("title", ""),
                body=payload.get("body", ""),
                difficulty=payload.get("difficulty", "Medium"),
                objective_id=version.objective_id,
                objective_description=objective.description if objective else "",
                unit_id=unit.id,
                unit_title=unit.title,
                topic_tags=objective.topic_tags if objective else [],
            ))
        
        return segments
    
    def get_content_for_student(
        self,
        student_id: str,
        classroom_id: str | None = None,
    ) -> list[CurriculumResult]:
        """
        Convenience method: analyze performance and retrieve matching content.
        """
        from app.services.performance import PerformanceAnalyzer
        
        analyzer = PerformanceAnalyzer(self.session)
        report = analyzer.get_student_performance(student_id, classroom_id)
        
        return self.get_remedial_content(report.weak_topics, student_id)
