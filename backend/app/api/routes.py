import os
from uuid import uuid4
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select, text
from app.api.auth import teacher
from app.api.ratelimit import rate_limit
from app.database import transaction
from app.models.entities import *
from app.schemas.contracts import *
from app.repositories.packs import owned, pack_dict, current_versions, evidence_rows
from app.services.packs import add_source, new_version, event, approve
from app.services.extraction import FileExtractor
from app.services.storage import ObjectStore

router = APIRouter(prefix="/api")


def asset_owned(s, aid, user):
    a = s.get(Asset, aid)
    if not a:
        raise HTTPException(404, "Asset not found")
    u = owned(s, a.unit_id, user, True)
    v = s.scalar(
        select(AssetVersion).where(
            AssetVersion.asset_id == aid, AssetVersion.number == a.current_number
        )
    )
    return u, a, v


def queue(s, u, kind, aid=None):
    if s.scalar(
        select(Job).where(Job.unit_id == u.id, Job.state.in_(["Queued", "Running"]))
    ):
        raise HTTPException(
            409, "A job is already active for this pack. Wait or cancel it first."
        )
    j = Job(unit_id=u.id, kind=kind, asset_id=aid, expected_revision=u.revision)
    s.add(j)
    s.flush()
    return {"id": j.id, "state": j.state}


@router.get("/health")
def health():
    return {
        "status": "ok",
        "provider": os.getenv("LLM_PROVIDER", "mock"),
        "auth": os.getenv("AUTH_MODE", "local"),
    }


@router.get("/packs")
def packs(user=Depends(teacher)):
    with transaction() as s:
        return [
            dict(
                id=u.id,
                title=u.title,
                subject=u.subject,
                level=u.level,
                exam=u.exam,
                revision=u.revision,
                created_at=u.created_at,
            )
            for u in s.scalars(
                select(Unit)
                .where(Unit.owner_id == user)
                .order_by(Unit.created_at.desc())
            )
        ]


@router.post("/packs", status_code=201)
def create(body: PackInput, user=Depends(teacher)):
    with transaction() as s:
        u = Unit(owner_id=user, **body.model_dump(exclude={"objectives"}))
        s.add(u)
        s.flush()
        for i, text in enumerate(body.objectives):
            s.add(Objective(unit_id=u.id, description=text, position=i + 1))
        s.add(
            Timeline(
                unit_id=u.id,
                revision=1,
                title="Pack created",
                detail="Source → Evidence → Objectives → Generate → Validate → Approve",
            )
        )
        return {"id": u.id}


@router.get("/packs/{pid}")
def detail(pid: str, user=Depends(teacher)):
    with transaction() as s:
        return pack_dict(s, owned(s, pid, user))


@router.post("/packs/{pid}/sources/text")
def text_source(pid: str, body: TextSource, user=Depends(teacher)):
    with transaction() as s:
        u = owned(s, pid, user, True)
        d = add_source(
            s,
            u,
            body.name,
            [("Teacher notes", body.text)],
            body.text.encode(),
            source_id=body.source_id,
        )
        return {"id": d.id}


@router.post("/packs/{pid}/sources")
@rate_limit("source-upload", capacity=10, refill_per_second=1 / 30)
def upload(
    pid: str,
    file: UploadFile = File(...),
    source_id: str | None = Form(default=None),
    user=Depends(teacher),
):
    with transaction() as s:
        owned(s, pid, user)
        if source_id:
            existing = s.get(Source, source_id)
            if not existing or existing.unit_id != pid:
                raise HTTPException(404, "Source not found in this pack")
    data = file.file.read(10 * 1024 * 1024 + 1)
    name = (file.filename or "upload").replace("\\", "/").split("/")[-1]
    rows = FileExtractor().extract(name, data)
    key = f"{user}/{pid}/{uuid4()}/{name}"
    try:
        ObjectStore().put(key, data)
    except Exception:
        raise HTTPException(
            502, "Private storage unavailable. Source was not added; retry upload."
        )
    try:
        with transaction() as s:
            u = owned(s, pid, user, True)
            d = add_source(s, u, name, rows, data, key, source_id)
            return {"id": d.id}
    except Exception:
        # Compensate for Storage and PostgreSQL not sharing a transaction.
        try:
            ObjectStore().delete(key)
        except Exception:
            import logging

            logging.warning("Source upload rollback requires storage cleanup")
        raise


@router.post("/packs/{pid}/gap-check", status_code=202)
@rate_limit("gap-check", capacity=5, refill_per_second=1 / 60)
def gap(pid: str, user=Depends(teacher)):
    with transaction() as s:
        return queue(s, owned(s, pid, user, True), "gap")


@router.post("/packs/{pid}/generate", status_code=202)
@rate_limit("generate", capacity=3, refill_per_second=1 / 120)
def generate(pid: str, user=Depends(teacher)):
    with transaction() as s:
        u = owned(s, pid, user, True)
        if current_versions(s, pid):
            raise HTTPException(
                409, "Pack exists. Regenerate a single draft asset instead."
            )
        return queue(s, u, "generate")


@router.get("/packs/{pid}/status")
def status(pid: str, user=Depends(teacher)):
    with transaction() as s:
        return pack_dict(s, owned(s, pid, user))["jobs"]


@router.post("/jobs/{jid}/cancel")
def cancel(jid: str, user=Depends(teacher)):
    with transaction() as s:
        j = s.get(Job, jid)
        if not j:
            raise HTTPException(404, "Job not found")
        owned(s, j.unit_id, user, True)
        if j.state not in ["Queued", "Running"]:
            raise HTTPException(409, "Job already finished")
        j.state = "Cancelled"
        j.message = "Cancelled by teacher. No generated changes will be committed."
        return {"state": j.state}


@router.post("/assets/{aid}/regenerate", status_code=202)
@rate_limit("regenerate", capacity=5, refill_per_second=1 / 60)
def regenerate(aid: str, user=Depends(teacher)):
    with transaction() as s:
        u, a, v = asset_owned(s, aid, user)
        if v.state == "APPROVED":
            raise HTTPException(
                409, "Approved version is locked. Create a new draft first."
            )
        return queue(s, u, "regenerate", aid)


@router.patch("/assets/{aid}")
def edit(aid: str, body: EditInput, user=Depends(teacher)):
    with transaction() as s:
        u, a, v = asset_owned(s, aid, user)
        if v.state == "APPROVED":
            raise HTTPException(
                409, "Approved assets are locked. Create a new draft first."
            )
        if v.number != body.expected_version:
            raise HTTPException(
                409,
                "Version changed since you opened the editor. Reload before saving.",
            )
        try:
            n = new_version(
                s,
                u,
                a,
                body.payload.model_dump(),
                v.objective_id,
                "teacher edit",
                "edited",
                v.settings,
            )
        except ValueError as e:
            raise HTTPException(422, str(e))
        event(
            s,
            u,
            f"{a.slot} edited",
            f"Only {a.slot} changed to v{n.number}; other assets unchanged.",
        )
        return {"version": n.number}


@router.post("/assets/{aid}/draft")
def draft(aid: str, user=Depends(teacher)):
    with transaction() as s:
        u, a, v = asset_owned(s, aid, user)
        if v.state != "APPROVED":
            raise HTTPException(409, "This asset is already a draft")
        # Copy preserves original provenance and staleness; never relabel old text as grounded in a new source.
        a.current_number += 1
        n = AssetVersion(
            asset_id=a.id,
            number=a.current_number,
            objective_id=v.objective_id,
            payload=v.payload,
            state="DRAFT",
            source_revision=v.source_revision,
            model=v.model,
            settings=v.settings,
            change_type="new draft",
            created_by=user,
        )
        s.add(n)
        s.flush()
        for link in s.scalars(
            select(AssetEvidence).where(AssetEvidence.version_id == v.id)
        ):
            s.add(AssetEvidence(version_id=n.id, evidence_id=link.evidence_id))
        for c in s.scalars(select(Check).where(Check.version_id == v.id)):
            s.add(Check(version_id=n.id, name=c.name, state=c.state, detail=c.detail))
        event(
            s,
            u,
            f"New draft: {a.slot}",
            f"v{v.number} remains published until another version is approved (unless source is stale).",
        )
        return {"version": n.number}


@router.post("/assets/{aid}/approve")
def approve_asset(aid: str, body: ReviewInput, user=Depends(teacher)):
    with transaction() as s:
        u, a, v = asset_owned(s, aid, user)
        if body.expected_version != v.number:
            raise HTTPException(
                409,
                "Asset changed since review opened. Inspect the current version before approving.",
            )
        approve(s, u, a, v, user, body.note)
        event(
            s,
            u,
            f"{a.slot} approved",
            f"Exact version v{v.number} locked and published.",
        )
        return {"state": "APPROVED"}


@router.post("/packs/{pid}/approve")
def approve_pack(pid: str, body: ReviewInput, user=Depends(teacher)):
    with transaction() as s:
        u = owned(s, pid, user, True)
        if body.expected_revision != u.revision:
            raise HTTPException(
                409,
                "Pack changed since review opened. Reload and review current versions.",
            )
        rows = current_versions(s, pid)
        if not rows:
            raise HTTPException(409, "Generate assets before approval")
        gaps = list(
            s.scalars(
                select(Objective).where(
                    Objective.unit_id == pid, Objective.status != "SUPPORTED"
                )
            )
        )
        if gaps:
            raise HTTPException(
                409,
                "Whole-pack approval requires supported objectives. You may approve individual supported assets.",
            )
        for a, v in rows:
            approve(s, u, a, v, user, body.note)
        event(
            s,
            u,
            "Pack approved",
            "All current asset versions locked; teacher reviewed evidence, correctness and warnings.",
        )
        return {"state": "APPROVED"}


@router.get("/assets/{aid}/evidence")
def evidence(aid: str, user=Depends(teacher)):
    with transaction() as s:
        u, a, v = asset_owned(s, aid, user)
        ids = set(
            s.scalars(
                select(AssetEvidence.evidence_id).where(
                    AssetEvidence.version_id == v.id
                )
            )
        )
        return [e for e in evidence_rows(s, u.id, False) if e["id"] in ids]


@router.get("/packs/{pid}/validation")
def validation(pid: str, user=Depends(teacher)):
    with transaction() as s:
        data = pack_dict(s, owned(s, pid, user))
        return {"assets": data["assets"], "objectives": data["objectives"]}


@router.get("/packs/{pid}/versions")
def versions(pid: str, user=Depends(teacher)):
    with transaction() as s:
        owned(s, pid, user)
        return [
            dict(
                id=t.id,
                revision=t.revision,
                title=t.title,
                detail=t.detail,
                created_at=t.created_at,
            )
            for t in s.scalars(
                select(Timeline)
                .where(Timeline.unit_id == pid)
                .order_by(Timeline.revision.desc())
            )
        ]


@router.post("/video-jobs", status_code=202)
@rate_limit("video", capacity=3, refill_per_second=1 / 120)
def video(body: VideoInput, user=Depends(teacher)):
    with transaction() as s:
        u = owned(s, body.pack_id, user, True)
        row = next(
            ((a, v) for a, v in current_versions(s, u.id) if a.slot == "video_script"),
            None,
        )
        if (
            not row
            or row[1].state != "APPROVED"
            or row[1].source_revision != u.source_revision
        ):
            raise HTTPException(
                409, "Approve the current video script before rendering."
            )
        job = queue(s, u, "video")
        v = VideoJob(unit_id=u.id, script_version_id=row[1].id, job_id=job["id"])
        s.add(v)
        s.flush()
        return {"id": v.id}


@router.get("/video-jobs/{vid}")
def video_status(vid: str, user=Depends(teacher)):
    with transaction() as s:
        v = s.get(VideoJob, vid)
        if not v:
            raise HTTPException(404, "Video job not found")
        owned(s, v.unit_id, user)
        return {"id": v.id, "state": v.state, "provider": v.provider, "url": v.url}


@router.get("/packs/{pid}/resources")
def resources(pid: str, user=Depends(teacher)):
    with transaction() as s:
        owned(s, pid, user)
        return [
            dict(
                id=r.id,
                title=r.title,
                channel=r.channel,
                url=f"https://www.youtube.com/watch?v={r.video_id}",
                approved=r.approved,
            )
            for r in s.scalars(select(Resource).where(Resource.unit_id == pid))
        ]


@router.post("/packs/{pid}/resources/search")
@rate_limit("resource-search", capacity=5, refill_per_second=1 / 60)
def search_resources(pid: str, user=Depends(teacher)):
    with transaction() as s:
        u = owned(s, pid, user)
        query = f"{u.title} {u.level}"
    key = os.getenv("YOUTUBE_API_KEY")
    if not key:
        raise HTTPException(
            503, "YouTube API is not configured. No URLs were fabricated."
        )
    try:
        r = httpx.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "key": key,
                "part": "snippet",
                "type": "video",
                "q": query,
                "maxResults": 5,
                "safeSearch": "strict",
            },
            timeout=20,
        )
        r.raise_for_status()
        items = r.json()["items"]
    except Exception:
        raise HTTPException(502, "YouTube search unavailable; retry later.")
    with transaction() as s:
        owned(s, pid, user)
        for item in items:
            vid = item["id"]["videoId"]
            if not s.scalar(
                select(Resource).where(
                    Resource.unit_id == pid, Resource.video_id == vid
                )
            ):
                s.add(
                    Resource(
                        unit_id=pid,
                        video_id=vid,
                        title=item["snippet"]["title"],
                        channel=item["snippet"]["channelTitle"],
                    )
                )
    return {"count": len(items)}


@router.post("/resources/{rid}/approve")
def approve_resource(rid: str, user=Depends(teacher)):
    with transaction() as s:
        r = s.get(Resource, rid)
        if not r:
            raise HTTPException(404, "Resource not found")
        owned(s, r.unit_id, user)
        r.approved = True
        return {"approved": True}


# Student capability URLs expose only an explicit allowlist. No teacher token is used here.
@router.get("/student/{token}")
def student(token: str):
    if os.getenv("AUTH_MODE") == "supabase":
        with transaction() as s:
            result = s.scalar(
                text("SELECT lf_private.student_pack(:token)"), {"token": token}
            )
            if result is None:
                raise HTTPException(404, "Learning pack not found")
            return result
    with transaction() as s:
        u = s.scalar(select(Unit).where(Unit.share_token == token))
        if not u:
            raise HTTPException(404, "Learning pack not found")
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
                    id=v.id,
                    slot=a.slot,
                    title=p["title"],
                    body=p["body"],
                    options=p["options"],
                    flowchart=p.get("flowchart"),
                )
            )
        return {
            "title": u.title,
            "subject": u.subject,
            "level": u.level,
            "assets": output,
            "resources": [
                dict(title=r.title, url=f"https://www.youtube.com/watch?v={r.video_id}")
                for r in s.scalars(
                    select(Resource).where(
                        Resource.unit_id == u.id, Resource.approved == True
                    )
                )
            ],
        }


@router.post("/student/{token}/answers/{vid}")
def answer(token: str, vid: str, body: Choice):
    if os.getenv("AUTH_MODE") == "supabase":
        with transaction() as s:
            result = s.scalar(
                text("SELECT lf_private.student_answer(:token, :vid, :choice)"),
                {"token": token, "vid": vid, "choice": body.choice},
            )
            if result is None:
                raise HTTPException(404, "Published question unavailable")
            return result
    with transaction() as s:
        u = s.scalar(select(Unit).where(Unit.share_token == token))
        v = s.get(AssetVersion, vid)
        a = s.get(Asset, v.asset_id) if v else None
        if (
            not u
            or not a
            or a.unit_id != u.id
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


@router.post("/demo", status_code=201)
def demo(user=Depends(teacher)):
    if os.getenv("LLM_PROVIDER", "mock") != "mock":
        raise HTTPException(
            409,
            "Demo fixtures require explicit LLM_PROVIDER=mock. Create a fresh pack for live generation.",
        )
    from app.seed import SOURCE

    result = create(
        PackInput(
            title="Newton's Laws of Motion",
            summary="Explicit development fixture · not live AI generation.",
            objectives=[
                "Explain Newton's three laws of motion",
                "Solve force and acceleration problems",
                "Interpret free-body diagrams",
            ],
        ),
        user=user,
    )
    with transaction() as s:
        u = owned(s, result["id"], user)
        import hashlib

        u.constraints = {
            **u.constraints,
            "demo_fixture": "newton",
            "demo_source_hash": hashlib.sha256(SOURCE.encode()).hexdigest(),
        }
        add_source(
            s,
            u,
            "Newton — demonstration notes.txt",
            [(f"Section {i + 1}", text) for i, text in enumerate(SOURCE.split("\n"))],
            SOURCE.encode(),
        )
        queue(s, u, "gap")
    return result


@router.patch("/objectives/{oid}")
def edit_objective(oid: str, body: ObjectiveEdit, user=Depends(teacher)):
    from sqlalchemy import delete

    with transaction() as s:
        o = s.get(Objective, oid)
        if not o:
            raise HTTPException(404, "Objective not found")
        u = owned(s, o.unit_id, user, True)
        o.description = body.description.strip()
        o.status = "UNCHECKED"
        o.reason = "Objective changed. Recheck support before generation."
        s.execute(
            delete(ObjectiveEvidence).where(ObjectiveEvidence.objective_id == oid)
        )
        u.source_revision += 1
        event(
            s,
            u,
            "Objective revised",
            f"OBJ-{o.position} changed. Existing assets retain their original contract and are stale.",
        )
        return {"id": oid}


@router.get("/packs/{pid}/answer-key")
def answer_key(pid: str, user=Depends(teacher)):
    from app.repositories.packs import asset_dict

    with transaction() as s:
        u = owned(s, pid, user)
        rows = s.execute(
            select(Asset, AssetVersion)
            .join(
                AssetVersion,
                (AssetVersion.asset_id == Asset.id)
                & (AssetVersion.number == Asset.published_number),
            )
            .where(
                Asset.unit_id == pid,
                AssetVersion.state == "APPROVED",
                AssetVersion.source_revision == u.source_revision,
            )
        )
        return [
            asset_dict(s, a, v, u)
            for a, v in rows
            if a.slot.startswith(("quiz", "assessment"))
        ]


@router.get("/assets/{aid}")
def get_asset(aid: str, user=Depends(teacher)):
    from app.repositories.packs import asset_dict

    with transaction() as s:
        u, a, v = asset_owned(s, aid, user)
        return asset_dict(s, a, v, u)


@router.get("/assets/{aid}/versions")
def asset_versions(aid: str, user=Depends(teacher)):
    from app.repositories.packs import asset_dict

    with transaction() as s:
        u, a, v = asset_owned(s, aid, user)
        return [
            asset_dict(s, a, x, u)
            for x in s.scalars(
                select(AssetVersion)
                .where(AssetVersion.asset_id == aid)
                .order_by(AssetVersion.number.desc())
            )
        ]


@router.get("/sources/{sid}/versions/{number}/download")
def source_download(sid: str, number: int, user=Depends(teacher)):
    with transaction() as s:
        source = s.get(Source, sid)
        if not source:
            raise HTTPException(404, "Source not found")
        owned(s, source.unit_id, user)
        version = s.scalar(
            select(SourceVersion).where(
                SourceVersion.source_id == sid, SourceVersion.number == number
            )
        )
        if not version or not version.storage_key:
            raise HTTPException(404, "No original file for this source version")
        key = version.storage_key
    if os.getenv("AUTH_MODE") != "supabase":
        raise HTTPException(
            409, "Temporary original-file downloads require Supabase Storage"
        )
    try:
        return ObjectStore().sign(key)
    except Exception:
        raise HTTPException(502, "Private source download unavailable; retry") from None
