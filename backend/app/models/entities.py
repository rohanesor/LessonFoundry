from datetime import datetime, timezone
from uuid import uuid4, UUID
from sqlalchemy import (
    String,
    Text,
    Integer,
    Boolean,
    ForeignKey,
    JSON,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


def uid():
    return str(uuid4())


def now():
    return datetime.now(timezone.utc).isoformat()


class Identity:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)


class User(Identity, Base):
    __tablename__ = "users"
    name: Mapped[str] = mapped_column(String, default="Teacher")
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, default="teacher")
    auth_user_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    institution_type: Mapped[str | None] = mapped_column(String, nullable=True)
    institution_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    grade_level: Mapped[str | None] = mapped_column(String(100), nullable=True)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)


class Unit(Identity, Base):
    __tablename__ = "units"
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String)
    subject: Mapped[str] = mapped_column(String, default="Physics")
    level: Mapped[str] = mapped_column(String, default="Class 11")
    exam: Mapped[str] = mapped_column(String, default="CBSE / JEE")
    summary: Mapped[str] = mapped_column(Text, default="")
    constraints: Mapped[dict] = mapped_column(JSON, default=dict)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    source_revision: Mapped[int] = mapped_column(Integer, default=1)
    share_token: Mapped[str] = mapped_column(String, default=uid, unique=True)
    classroom_id: Mapped[str | None] = mapped_column(
        ForeignKey("classrooms.id", use_alter=True), nullable=True, index=True
    )
    published_at: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, default=now)


class Source(Identity, Base):
    __tablename__ = "source_documents"
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id"), index=True)
    name: Mapped[str] = mapped_column(String)
    current_version: Mapped[int] = mapped_column(Integer, default=1)


class SourceVersion(Identity, Base):
    __tablename__ = "source_versions"
    __table_args__ = (UniqueConstraint("source_id", "number"),)
    source_id: Mapped[str] = mapped_column(
        ForeignKey("source_documents.id"), index=True
    )
    number: Mapped[int] = mapped_column(Integer)
    hash: Mapped[str] = mapped_column(String)
    storage_key: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, default=now)


class Chunk(Identity, Base):
    __tablename__ = "source_chunks"
    source_version_id: Mapped[str] = mapped_column(
        ForeignKey("source_versions.id"), index=True
    )
    text: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(String)
    position: Mapped[int] = mapped_column(Integer)


class Evidence(Identity, Base):
    __tablename__ = "evidence"
    chunk_id: Mapped[str] = mapped_column(ForeignKey("source_chunks.id"), index=True)


class Objective(Identity, Base):
    __tablename__ = "objectives"
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id"), index=True)
    description: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, default="UNCHECKED")
    reason: Mapped[str] = mapped_column(
        Text, default="Run evidence mapping before generation."
    )


class ObjectiveEvidence(Base):
    __tablename__ = "objective_evidence"
    objective_id: Mapped[str] = mapped_column(
        ForeignKey("objectives.id"), primary_key=True
    )
    evidence_id: Mapped[str] = mapped_column(
        ForeignKey("evidence.id"), primary_key=True
    )


class Asset(Identity, Base):
    __tablename__ = "assets"
    __table_args__ = (UniqueConstraint("unit_id", "slot"),)
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id"), index=True)
    slot: Mapped[str] = mapped_column(String)
    current_number: Mapped[int] = mapped_column(Integer, default=0)
    published_number: Mapped[int | None] = mapped_column(Integer, nullable=True)


class AssetVersion(Identity, Base):
    __tablename__ = "asset_versions"
    __table_args__ = (UniqueConstraint("asset_id", "number"),)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    objective_id: Mapped[str] = mapped_column(ForeignKey("objectives.id"))
    payload: Mapped[dict] = mapped_column(JSON)
    state: Mapped[str] = mapped_column(String, default="DRAFT")
    source_revision: Mapped[int] = mapped_column(Integer)
    model: Mapped[str] = mapped_column(String)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    change_type: Mapped[str] = mapped_column(String)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[str] = mapped_column(String, default=now)


class AssetEvidence(Base):
    __tablename__ = "asset_evidence"
    version_id: Mapped[str] = mapped_column(
        ForeignKey("asset_versions.id"), primary_key=True
    )
    evidence_id: Mapped[str] = mapped_column(
        ForeignKey("evidence.id"), primary_key=True
    )


class Claim(Identity, Base):
    __tablename__ = "claims"
    version_id: Mapped[str] = mapped_column(ForeignKey("asset_versions.id"), index=True)
    statement: Mapped[str] = mapped_column(Text)


class ClaimEvidence(Base):
    __tablename__ = "claim_evidence"
    claim_id: Mapped[str] = mapped_column(ForeignKey("claims.id"), primary_key=True)
    evidence_id: Mapped[str] = mapped_column(
        ForeignKey("evidence.id"), primary_key=True
    )


class Check(Identity, Base):
    __tablename__ = "quality_checks"
    version_id: Mapped[str] = mapped_column(ForeignKey("asset_versions.id"), index=True)
    name: Mapped[str] = mapped_column(String)
    state: Mapped[str] = mapped_column(String)
    detail: Mapped[str] = mapped_column(Text)


class Approval(Identity, Base):
    __tablename__ = "approvals"
    version_id: Mapped[str] = mapped_column(
        ForeignKey("asset_versions.id"), unique=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, default=now)


class Timeline(Identity, Base):
    __tablename__ = "pack_events"
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id"), index=True)
    revision: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String)
    detail: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, default=now)


class Job(Identity, Base):
    __tablename__ = "jobs"
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id"), index=True)
    kind: Mapped[str] = mapped_column(String)
    asset_id: Mapped[str | None] = mapped_column(ForeignKey("assets.id"), nullable=True)
    expected_revision: Mapped[int] = mapped_column(Integer)
    state: Mapped[str] = mapped_column(String, default="Queued", index=True)
    message: Mapped[str] = mapped_column(Text, default="Waiting for worker")
    created_at: Mapped[str] = mapped_column(String, default=now)


class Avatar(Identity, Base):
    __tablename__ = "avatars"
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    storage_key: Mapped[str] = mapped_column(String)
    mime_type: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="ready")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(50), default="teacher_upload")
    created_at: Mapped[str] = mapped_column(String, default=now)


class TeacherVideo(Identity, Base):
    __tablename__ = "teacher_videos"
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    pack_id: Mapped[str | None] = mapped_column(ForeignKey("units.id"), nullable=True, index=True)
    avatar_id: Mapped[str | None] = mapped_column(ForeignKey("avatars.id"), nullable=True)
    script_version_id: Mapped[str | None] = mapped_column(ForeignKey("asset_versions.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    storage_key: Mapped[str] = mapped_column(String)
    mime_type: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="ready")
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(String, default=now)


class VideoJob(Identity, Base):
    __tablename__ = "video_jobs"
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id"), index=True)
    script_version_id: Mapped[str] = mapped_column(ForeignKey("asset_versions.id"))
    avatar_id: Mapped[str | None] = mapped_column(ForeignKey("avatars.id"), nullable=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"))
    provider: Mapped[str] = mapped_column(String, default="mock-avatar")
    state: Mapped[str] = mapped_column(String, default="Queued")
    url: Mapped[str | None] = mapped_column(String, nullable=True)


class Resource(Identity, Base):
    __tablename__ = "resources"
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id"), index=True)
    video_id: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    channel: Mapped[str] = mapped_column(String)
    approved: Mapped[bool] = mapped_column(Boolean, default=False)


class Classroom(Identity, Base):
    __tablename__ = "classrooms"
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    join_code: Mapped[str] = mapped_column(String(10), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[str] = mapped_column(String, default=now)
    updated_at: Mapped[str] = mapped_column(String, default=now)


class ClassroomMember(Identity, Base):
    __tablename__ = "classroom_members"
    __table_args__ = (UniqueConstraint("classroom_id", "user_id"),)
    classroom_id: Mapped[str] = mapped_column(
        ForeignKey("classrooms.id"), index=True
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    joined_at: Mapped[str] = mapped_column(String, default=now)


class Export(Identity, Base):
    __tablename__ = "exports"
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id"), index=True)
    revision: Mapped[int] = mapped_column(Integer)
    requested_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String, nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str] = mapped_column(String(100), default="application/pdf")
    status: Mapped[str] = mapped_column(String(20), default="queued")
    created_at: Mapped[str] = mapped_column(String, default=now)
    completed_at: Mapped[str | None] = mapped_column(String, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
