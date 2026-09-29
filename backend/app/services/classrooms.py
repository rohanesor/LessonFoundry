"""Classroom services: join-code generation, membership, publication."""

import secrets
from sqlalchemy import select, func
from fastapi import HTTPException
from app.models.entities import Classroom, ClassroomMember, Unit, now

# Safe alphabet excluding confusable chars: 0/O, 1/I/L, U/V
_ALPHABET = "23456789ABCDEFGHJKMNPQRSTWXYZ"


def generate_join_code() -> str:
    """Generate a classroom join code like LF-7K29Q."""
    code = "".join(secrets.choice(_ALPHABET) for _ in range(5))
    return f"LF-{code}"


def classroom_owned(s, classroom_id: str, user_id: str, lock: bool = False):
    """Return classroom if owned by user, else 404."""
    q = select(Classroom).where(
        Classroom.id == classroom_id,
        Classroom.owner_id == user_id,
        Classroom.status == "active",
    )
    if lock:
        q = q.with_for_update()
    c = s.scalar(q)
    if not c:
        raise HTTPException(404, "Classroom not found")
    return c


def find_classroom_by_code(s, code: str) -> Classroom | None:
    """Find active classroom by join code, bypassing RLS during student join handshake."""
    code_clean = code.upper().strip()
    if s.bind.dialect.name == "postgresql":
        from sqlalchemy import text
        return s.scalars(
            select(Classroom).from_statement(
                text("SELECT * FROM lf_private.find_classroom_by_join_code(:code)")
            ),
            {"code": code_clean},
        ).first()
    return s.scalar(
        select(Classroom).where(
            Classroom.join_code == code_clean,
            Classroom.status == "active",
        )
    )


def find_classroom_for_join(s, cid: str) -> Classroom | None:
    """Find active classroom by ID, bypassing RLS during student join handshake."""
    if s.bind.dialect.name == "postgresql":
        from sqlalchemy import text
        return s.scalars(
            select(Classroom).from_statement(
                text("SELECT * FROM lf_private.get_classroom_for_join(:cid)")
            ),
            {"cid": cid},
        ).first()
    return s.scalar(
        select(Classroom).where(
            Classroom.id == cid,
            Classroom.status == "active",
        )
    )



def classroom_summary(s, c: Classroom) -> dict:
    member_count = s.scalar(
        select(func.count()).where(
            ClassroomMember.classroom_id == c.id,
            ClassroomMember.status == "active",
        )
    )
    pack_count = s.scalar(
        select(func.count()).where(Unit.classroom_id == c.id)
    )
    return dict(
        id=c.id,
        name=c.name,
        description=c.description,
        join_code=c.join_code,
        status=c.status,
        member_count=member_count or 0,
        pack_count=pack_count or 0,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


def derive_pack_status(s, u: Unit) -> str:
    """Derive the conceptual pack status from database state."""
    from app.models.entities import Job, Asset, AssetVersion
    from app.repositories.packs import current_versions

    if u.published_at:
        return "PUBLISHED"
    active_job = s.scalar(
        select(Job).where(
            Job.unit_id == u.id,
            Job.state.in_(["Queued", "Running"]),
        )
    )
    if active_job:
        return "GENERATING"
    versions = current_versions(s, u.id)
    if not versions:
        return "DRAFT"
    all_approved = all(v.state == "APPROVED" for _, v in versions)
    if all_approved:
        return "APPROVED"
    any_generated = any(True for _ in versions)
    if any_generated:
        return "READY_FOR_REVIEW"
    return "DRAFT"
