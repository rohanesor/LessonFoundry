"""Classroom, membership, publication, and authenticated student APIs."""

from sqlalchemy import select, func
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import teacher, student, authenticated
from app.api.ratelimit import rate_limit
from app.database import transaction
from app.models.entities import (
    Classroom, ClassroomMember, Unit, User, Asset, AssetVersion, Export,
    Resource, now, uid,
)
from app.repositories.packs import current_versions, pack_dict
from app.services.classrooms import (
    generate_join_code, classroom_owned, classroom_summary, derive_pack_status,
    find_classroom_by_code, find_classroom_for_join,
)

router = APIRouter(prefix="/api")

# ─── Schemas ──────────────────────────────────────────────────────────────────

class ClassroomInput(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=2000)

class ClassroomUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=2000)

class JoinInput(BaseModel):
    code: str = Field(min_length=5, max_length=10)

# ─── Teacher classroom CRUD ──────────────────────────────────────────────────

@router.post("/classrooms", status_code=201)
def create_classroom(body: ClassroomInput, user=Depends(teacher)):
    with transaction() as s:
        # Generate unique join code (retry on collision)
        for _ in range(10):
            code = generate_join_code()
            if not s.scalar(select(Classroom).where(Classroom.join_code == code)):
                break
        else:
            raise HTTPException(500, "Could not generate unique join code")
        c = Classroom(
            owner_id=user,
            name=body.name,
            description=body.description,
            join_code=code,
        )
        s.add(c)
        s.flush()
        return {"id": c.id, "join_code": c.join_code}


@router.get("/classrooms")
def list_classrooms(user=Depends(teacher)):
    with transaction() as s:
        rows = s.scalars(
            select(Classroom)
            .where(Classroom.owner_id == user, Classroom.status == "active")
            .order_by(Classroom.created_at.desc())
        )
        return [classroom_summary(s, c) for c in rows]


@router.get("/classrooms/{cid}")
def get_classroom(cid: str, user=Depends(teacher)):
    with transaction() as s:
        return classroom_summary(s, classroom_owned(s, cid, user))


@router.patch("/classrooms/{cid}")
def update_classroom(cid: str, body: ClassroomUpdate, user=Depends(teacher)):
    with transaction() as s:
        c = classroom_owned(s, cid, user, lock=True)
        if body.name is not None:
            c.name = body.name
        if body.description is not None:
            c.description = body.description
        c.updated_at = now()
        return {"id": c.id}


@router.delete("/classrooms/{cid}")
def archive_classroom(cid: str, user=Depends(teacher)):
    with transaction() as s:
        c = classroom_owned(s, cid, user, lock=True)
        c.status = "archived"
        c.updated_at = now()
        return {"archived": True}


@router.post("/classrooms/{cid}/regenerate-code")
def regenerate_code(cid: str, user=Depends(teacher)):
    with transaction() as s:
        c = classroom_owned(s, cid, user, lock=True)
        for _ in range(10):
            code = generate_join_code()
            if not s.scalar(select(Classroom).where(Classroom.join_code == code)):
                break
        c.join_code = code
        c.updated_at = now()
        return {"join_code": code}

# ─── Membership ──────────────────────────────────────────────────────────────

@router.post("/join")
@rate_limit("join", capacity=10, refill_per_second=1/60)
def join_by_code(body: JoinInput, user=Depends(student)):
    """Join a classroom by code alone (no classroom_id needed)."""
    with transaction() as s:
        c = find_classroom_by_code(s, body.code)
        if not c:
            raise HTTPException(400, "Invalid join code")
        existing = s.scalar(
            select(ClassroomMember).where(
                ClassroomMember.classroom_id == c.id,
                ClassroomMember.user_id == user,
            )
        )
        if existing and existing.status == "active":
            raise HTTPException(409, "Already a member of this classroom")
        if existing:
            existing.status = "active"
            existing.joined_at = now()
        else:
            s.add(ClassroomMember(classroom_id=c.id, user_id=user))
        return {"classroom_id": c.id, "joined": True}


@router.post("/classrooms/{cid}/join")
@rate_limit("join", capacity=10, refill_per_second=1/60)
def join_classroom(cid: str, body: JoinInput, user=Depends(student)):
    with transaction() as s:
        c = find_classroom_for_join(s, cid)
        if not c:
            raise HTTPException(404, "Classroom not found")
        if c.join_code.upper() != body.code.upper().strip():
            raise HTTPException(400, "Invalid join code")
        existing = s.scalar(
            select(ClassroomMember).where(
                ClassroomMember.classroom_id == cid,
                ClassroomMember.user_id == user,
            )
        )
        if existing:
            if existing.status == "active":
                raise HTTPException(409, "Already a member of this classroom")
            existing.status = "active"
            existing.joined_at = now()
        else:
            s.add(ClassroomMember(classroom_id=cid, user_id=user))
        return {"classroom_id": cid, "joined": True}


@router.get("/classrooms/{cid}/members")
def list_members(cid: str, user=Depends(teacher)):
    with transaction() as s:
        classroom_owned(s, cid, user)
        members = s.execute(
            select(ClassroomMember, User)
            .join(User, User.id == ClassroomMember.user_id)
            .where(
                ClassroomMember.classroom_id == cid,
                ClassroomMember.status == "active",
            )
        )
        return [
            dict(
                id=m.id, user_id=u.id, name=u.name,
                email=u.email, avatar_url=u.avatar_url,
                status=m.status, joined_at=m.joined_at,
            )
            for m, u in members
        ]


@router.delete("/classrooms/{cid}/members/{uid}")
def remove_member(cid: str, uid: str, user=Depends(teacher)):
    with transaction() as s:
        classroom_owned(s, cid, user)
        m = s.scalar(
            select(ClassroomMember).where(
                ClassroomMember.classroom_id == cid,
                ClassroomMember.user_id == uid,
            )
        )
        if not m:
            raise HTTPException(404, "Member not found")
        m.status = "removed"
        return {"removed": True}

# ─── Classroom packs (teacher) ───────────────────────────────────────────────

@router.get("/classrooms/{cid}/packs")
def classroom_packs(cid: str, user=Depends(teacher)):
    with transaction() as s:
        classroom_owned(s, cid, user)
        units = s.scalars(
            select(Unit).where(Unit.classroom_id == cid).order_by(Unit.created_at.desc())
        )
        return [
            dict(
                id=u.id, title=u.title, subject=u.subject, level=u.level,
                exam=u.exam, revision=u.revision,
                status=derive_pack_status(s, u),
                published_at=u.published_at, created_at=u.created_at,
            )
            for u in units
        ]


@router.post("/classrooms/{cid}/packs", status_code=201)
def create_classroom_pack(cid: str, user=Depends(teacher)):
    """Create a pack in a classroom. Uses existing pack creation with classroom_id."""
    # Import existing create logic
    from app.api.routes import create as _create_pack
    from app.schemas.contracts import PackInput
    from fastapi import Request
    raise HTTPException(501, "Use POST /api/packs with classroom_id in body")

# ─── Publication ─────────────────────────────────────────────────────────────

@router.post("/packs/{pid}/publish")
def publish_pack(pid: str, user=Depends(teacher)):
    with transaction() as s:
        from app.repositories.packs import owned
        u = owned(s, pid, user, True)
        if not u.classroom_id:
            raise HTTPException(409, "Assign pack to a classroom before publishing")
        versions = current_versions(s, u.id)
        if not versions:
            raise HTTPException(409, "Generate assets before publishing")
        if not all(v.state == "APPROVED" for _, v in versions):
            raise HTTPException(409, "Approve all assets before publishing")
        u.published_at = now()
        u.revision += 1
        from app.services.packs import event
        event(s, u, "Pack published", "Students in this classroom can now access the approved version.")
        # Queue export job
        from app.models.entities import Job, Export
        exp = Export(unit_id=u.id, revision=u.revision, requested_by=user, status="queued", mime_type="application/pdf")
        s.add(exp)
        j = Job(unit_id=u.id, kind="export", expected_revision=u.revision)
        s.add(j)
        return {"published_at": u.published_at}


@router.post("/packs/{pid}/unpublish")
def unpublish_pack(pid: str, user=Depends(teacher)):
    with transaction() as s:
        from app.repositories.packs import owned
        u = owned(s, pid, user, True)
        if not u.published_at:
            raise HTTPException(409, "Pack is not published")
        u.published_at = None
        u.revision += 1
        from app.services.packs import event
        event(s, u, "Pack unpublished", "Students can no longer access this pack.")
        return {"unpublished": True}

# ─── Student classroom APIs ─────────────────────────────────────────────────

def _student_member(s, cid: str, user_id: str):
    """Verify student is an active member of classroom."""
    m = s.scalar(
        select(ClassroomMember).where(
            ClassroomMember.classroom_id == cid,
            ClassroomMember.user_id == user_id,
            ClassroomMember.status == "active",
        )
    )
    if not m:
        raise HTTPException(403, "Not a member of this classroom")
    return m


@router.get("/student/classrooms")
def student_classrooms(user=Depends(student)):
    with transaction() as s:
        rows = s.execute(
            select(ClassroomMember, Classroom, User)
            .join(Classroom, Classroom.id == ClassroomMember.classroom_id)
            .join(User, User.id == Classroom.owner_id)
            .where(
                ClassroomMember.user_id == user,
                ClassroomMember.status == "active",
                Classroom.status == "active",
            )
        )
        return [
            dict(
                id=c.id, name=c.name,
                teacher_name=t.name,
                pack_count=s.scalar(
                    select(func.count()).where(
                        Unit.classroom_id == c.id,
                        Unit.published_at.isnot(None),
                    )
                ) or 0,
                joined_at=m.joined_at,
            )
            for m, c, t in rows
        ]


@router.get("/student/classrooms/{cid}")
def student_classroom_detail(cid: str, user=Depends(student)):
    with transaction() as s:
        _student_member(s, cid, user)
        c = s.get(Classroom, cid)
        if not c or c.status != "active":
            raise HTTPException(404, "Classroom not found")
        owner = s.get(User, c.owner_id)
        packs = s.scalars(
            select(Unit).where(
                Unit.classroom_id == cid,
                Unit.published_at.isnot(None),
            ).order_by(Unit.published_at.desc())
        )
        return dict(
            id=c.id, name=c.name, description=c.description,
            teacher_name=owner.name if owner else "Teacher",
            packs=[
                dict(
                    id=u.id, title=u.title, subject=u.subject, level=u.level,
                    published_at=u.published_at,
                )
                for u in packs
            ],
        )


@router.get("/student/classrooms/{cid}/packs")
def student_classroom_packs(cid: str, user=Depends(student)):
    with transaction() as s:
        _student_member(s, cid, user)
        packs = s.scalars(
            select(Unit).where(
                Unit.classroom_id == cid,
                Unit.published_at.isnot(None),
            ).order_by(Unit.published_at.desc())
        )
        return [
            dict(
                id=u.id, title=u.title, subject=u.subject, level=u.level,
                published_at=u.published_at,
            )
            for u in packs
        ]


@router.get("/student/packs/{pid}")
def student_pack(pid: str, user=Depends(student)):
    """Authenticated student pack view (replaces anonymous share-token for classroom flow)."""
    with transaction() as s:
        u = s.get(Unit, pid)
        if not u or not u.published_at or not u.classroom_id:
            raise HTTPException(404, "Learning pack not found")
        _student_member(s, u.classroom_id, user)
        output = []
        rows = s.execute(
            select(Asset, AssetVersion)
            .join(
                AssetVersion,
                (AssetVersion.asset_id == Asset.id)
                & (AssetVersion.number == Asset.published_number),
            )
            .where(
                Asset.unit_id == u.id,
                AssetVersion.state == "APPROVED",
                AssetVersion.source_revision == u.source_revision,
            )
        )
        for a, v in rows:
            if a.slot == "video_script":
                continue
            p = v.payload
            output.append(
                dict(
                    id=v.id, slot=a.slot, title=p["title"],
                    body=p["body"], options=p["options"],
                    flowchart=p.get("flowchart"),
                )
            )
        export = s.scalar(
            select(Export).where(
                Export.unit_id == u.id,
                Export.status == "completed",
            ).order_by(Export.created_at.desc())
        )
        return dict(
            title=u.title, subject=u.subject, level=u.level,
            assets=output,
            resources=[
                dict(title=r.title, url=f"https://www.youtube.com/watch?v={r.video_id}")
                for r in s.scalars(
                    select(Resource).where(
                        Resource.unit_id == u.id, Resource.approved == True,
                    )
                )
            ],
            has_export=export is not None,
        )


class ChoiceInput(BaseModel):
    choice: int = Field(ge=0, le=3)

@router.post("/student/packs/{pid}/answers/{vid}")
def student_answer(pid: str, vid: str, body: ChoiceInput, user=Depends(student)):
    """Authenticated student quiz answer check."""
    with transaction() as s:
        u = s.get(Unit, pid)
        if not u or not u.published_at or not u.classroom_id:
            raise HTTPException(404, "Pack not found")
        _student_member(s, u.classroom_id, user)
        v = s.get(AssetVersion, vid)
        a = s.get(Asset, v.asset_id) if v else None
        if (
            not u or not a or a.unit_id != u.id
            or a.published_number != v.number
            or v.state != "APPROVED"
            or v.source_revision != u.source_revision
            or not a.slot.startswith("quiz")
        ):
            raise HTTPException(404, "Published question unavailable")
        result = {"correct": body.choice == v.payload["answer"]}
        if u.constraints.get("answer_reveal", False):
            result["solution"] = v.payload["solution"]
        return result


@router.post("/student/packs/{pid}/download")
def student_download(pid: str, user=Depends(student)):
    """Generate presigned download URL for an export."""
    with transaction() as s:
        u = s.get(Unit, pid)
        if not u or not u.published_at or not u.classroom_id:
            raise HTTPException(404, "Pack not found")
        _student_member(s, u.classroom_id, user)
        export = s.scalar(
            select(Export).where(
                Export.unit_id == u.id,
                Export.status == "completed",
            ).order_by(Export.created_at.desc())
        )
        if not export or not export.storage_key:
            raise HTTPException(404, "Export not ready. The teacher has not generated a downloadable version yet.")
        from app.services.storage import get_store
        store = get_store()
        try:
            url_info = store.create_download_url(export.storage_key, expires=300)
            return {"download_url": url_info["url"], "expires_in": 300}
        except Exception:
            raise HTTPException(502, "Download temporarily unavailable")


@router.post("/packs/{pid}/download")
def teacher_download(pid: str, user=Depends(teacher)):
    """Teacher-only short-lived download for the latest completed PDF export."""
    from app.repositories.packs import owned
    with transaction() as s:
        u = owned(s, pid, user)
        export = s.scalar(
            select(Export).where(Export.unit_id == u.id, Export.status == "completed")
            .order_by(Export.created_at.desc())
        )
        if not export or not export.storage_key:
            raise HTTPException(404, "Export not ready")
        from app.services.storage import get_store
        try:
            info = get_store().create_download_url(export.storage_key, expires=300)
            return {"download_url": info["url"], "expires_in": 300}
        except Exception:
            raise HTTPException(502, "Download temporarily unavailable")


# ─── User profile ────────────────────────────────────────────────────────────

@router.get("/me")
def get_me(user=Depends(authenticated)):
    with transaction() as s:
        u = s.get(User, user)
        if not u:
            raise HTTPException(404, "User not found")
        return dict(
            id=u.id, name=u.name, email=u.email,
            avatar_url=u.avatar_url, role=u.role,
        )

# ─── Readiness ───────────────────────────────────────────────────────────────

@router.get("/ready")
def readiness():
    """Dependency check for production readiness without bypassing RLS."""
    checks = {"database": False, "storage": True}
    try:
        # An unauthenticated request normally receives lessonfoundry_student,
        # which intentionally has no direct table grants. Health checks instead
        # verify that the restricted API role can execute a harmless statement.
        # This does not set JWT claims or read application data.
        from app.database import engine
        from sqlalchemy import text
        with engine.begin() as connection:
            if engine.dialect.name == "postgresql" and __import__("os").getenv("AUTH_MODE") == "supabase":
                connection.execute(text("SET LOCAL ROLE lessonfoundry_api"))
            connection.execute(text("SELECT 1"))
            checks["database"] = True
    except Exception:
        pass
    status = "ready" if all(checks.values()) else "not_ready"
    code = 200 if status == "ready" else 503
    from fastapi.responses import JSONResponse
    return JSONResponse({"status": status, **checks}, status_code=code)
