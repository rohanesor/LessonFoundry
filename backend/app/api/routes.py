import os
from pathlib import Path
from urllib.parse import urlparse, parse_qs
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
from app.services.storage import ObjectStore, get_store

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


@router.post("/packs/{pid}/sources/batch")
@rate_limit("source-batch-upload", capacity=5, refill_per_second=1 / 30)
def upload_batch(pid: str, files: list[UploadFile] = File(...), user=Depends(teacher)):
    """Resilient batch ingestion: extraction is concurrent, persistence is isolated per file."""
    if not files or len(files) > 10:
        raise HTTPException(400, "Choose between 1 and 10 files")
    owned_pid = pid
    with transaction() as s: owned(s, pid, user)
    items = []
    total = 0
    for file in files:
        data = file.file.read(10 * 1024 * 1024 + 1)
        total += len(data)
        name = (file.filename or "upload").replace("\\", "/").split("/")[-1]
        items.append((name, data))
    if total > 50 * 1024 * 1024:
        raise HTTPException(413, "Batch payload must be 50 MB or smaller")
    from concurrent.futures import ThreadPoolExecutor
    def extract(item):
        name, data = item
        try: return (name, data, FileExtractor().extract(name, data), None)
        except Exception as exc: return (name, data, None, str(exc))
    extracted = []
    with ThreadPoolExecutor(max_workers=min(3, len(items))) as pool:
        extracted = list(pool.map(extract, items))
    uploaded, errors = [], []
    for name, data, rows, error in extracted:
        if error:
            errors.append({"name": name, "status": "failed", "error": error}); continue
        key = f"{user}/{pid}/{uuid4()}/{name}"
        try:
            ObjectStore().put(key, data)
            with transaction() as s:
                u = owned(s, pid, user, True)
                d = add_source(s, u, name, rows, data, key)
                uploaded.append({"id": d.id, "name": name, "evidence_count": len(rows), "status": "extracted"})
        except Exception as exc:
            try: ObjectStore().delete(key)
            except Exception: pass
            errors.append({"name": name, "status": "failed", "error": "Source could not be saved"})
    return {"uploaded": uploaded, "errors": errors}


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


AVATAR_MIMES = {"image/png", "image/jpeg", "image/webp"}
VIDEO_MIMES = {"video/mp4", "video/webm", "video/quicktime"}


def _media_key(owner: str, kind: str, ident: str, filename: str) -> str:
    safe = Path(filename).name.replace(" ", "_")[:120]
    return f"{owner}/{kind}/{ident}/{safe}"


@router.get("/avatars")
def list_avatars(user=Depends(teacher)):
    demo_path = Path(os.getenv("AI_TEACHER_DEMO_AVATAR_PATH", "fixtures/ai_teacher_demo_avatar.png"))
    if not demo_path.is_absolute():
        candidates = [
            Path(__file__).resolve().parent.parent / "fixtures" / "ai_teacher_demo_avatar.png",
            Path.cwd() / demo_path,
            Path(__file__).resolve().parents[3] / demo_path,
            Path("backend/integration/fixtures/ai_teacher_demo_avatar.png"),
        ]
        demo_path = next((p for p in candidates if p.is_file()), candidates[0])
    with transaction() as s:
        demo = s.scalar(select(Avatar).where(Avatar.owner_id == user, Avatar.is_demo == True))
        if demo_path.is_file() and not demo:
            demo = Avatar(owner_id=user, name="LessonFoundry Demo Teacher", description="Supplied development avatar image", storage_key="", mime_type="image/png", is_demo=True, source="supplied_demo_asset")
            s.add(demo); s.flush(); demo.storage_key = _media_key(user, "avatars", demo.id, "demo-avatar.png")
            try: get_store("media").put(demo.storage_key, demo_path.read_bytes(), "image/png")
            except Exception: pass
        rows = s.scalars(select(Avatar).where(Avatar.owner_id == user).order_by(Avatar.created_at.desc()))
        return [dict(id=a.id, name=a.name, description=a.description, mime_type=a.mime_type, status=a.status, is_demo=a.is_demo, created_at=a.created_at) for a in rows]


@router.post("/avatars", status_code=201)
def create_avatar(name: str = Form(...), description: str = Form(""), file: UploadFile = File(...), user=Depends(teacher)):
    if file.content_type not in AVATAR_MIMES:
        raise HTTPException(415, "Avatar must be PNG, JPG, JPEG or WEBP")
    data = file.file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(413, "Avatar image must be 5 MB or smaller")
    avatar = Avatar(owner_id=user, name=name.strip()[:200], description=description[:2000], storage_key="", mime_type=file.content_type)
    with transaction() as s:
        s.add(avatar); s.flush()
        avatar.storage_key = _media_key(user, "avatars", avatar.id, file.filename or "avatar")
        try:
            get_store("media").put(avatar.storage_key, data, file.content_type)
        except Exception as exc:
            raise HTTPException(502, "Private avatar storage unavailable") from exc
        return dict(id=avatar.id, name=avatar.name, description=avatar.description, mime_type=avatar.mime_type, status=avatar.status, created_at=avatar.created_at)


@router.get("/avatars/{aid}/download")
def avatar_download(aid: str, user=Depends(teacher)):
    with transaction() as s:
        avatar = s.get(Avatar, aid)
        if not avatar or avatar.owner_id != user: raise HTTPException(404, "Avatar not found")
        try: return get_store("media").create_download_url(avatar.storage_key, expires=60)
        except Exception as exc: raise HTTPException(502, "Avatar preview unavailable") from exc


@router.get("/videos")
def list_videos(pack_id: str | None = None, user=Depends(teacher)):
    with transaction() as s:
        query = select(TeacherVideo).where(TeacherVideo.owner_id == user)
        if pack_id: query = query.where(TeacherVideo.pack_id == pack_id)
        return [dict(id=v.id, pack_id=v.pack_id, title=v.title, description=v.description, mime_type=v.mime_type, status=v.status, approved=v.approved, published=v.published, is_demo=v.is_demo, created_at=v.created_at) for v in s.scalars(query.order_by(TeacherVideo.created_at.desc()))]


@router.post("/videos", status_code=201)
def upload_video(title: str = Form(...), description: str = Form(""), pack_id: str | None = Form(None), file: UploadFile = File(...), user=Depends(teacher)):
    if file.content_type not in VIDEO_MIMES: raise HTTPException(415, "Video must be MP4, WEBM or MOV")
    data = file.file.read()
    if len(data) > 250 * 1024 * 1024: raise HTTPException(413, "Video must be 250 MB or smaller")
    with transaction() as s:
        if pack_id: owned(s, pack_id, user, True)
        video = TeacherVideo(owner_id=user, pack_id=pack_id, title=title.strip()[:200], description=description[:2000], storage_key="", mime_type=file.content_type)
        s.add(video); s.flush(); video.storage_key = _media_key(user, "videos", video.id, file.filename or "video")
        try: get_store("media").put(video.storage_key, data, file.content_type)
        except Exception as exc: raise HTTPException(502, "Private video storage unavailable") from exc
        return dict(id=video.id, title=video.title, status=video.status, approved=video.approved, published=video.published, is_demo=False)


@router.post("/videos/{vid}/attach")
def attach_video(vid: str, pack_id: str = Form(...), avatar_id: str | None = Form(None), user=Depends(teacher)):
    with transaction() as s:
        v = s.get(TeacherVideo, vid); u = owned(s, pack_id, user, True)
        if not v or v.owner_id != user: raise HTTPException(404, "Video not found")
        if avatar_id and (not s.get(Avatar, avatar_id) or s.get(Avatar, avatar_id).owner_id != user): raise HTTPException(404, "Avatar not found")
        v.pack_id = u.id; v.avatar_id = avatar_id; v.approved = False; v.published = False
        return {"id": v.id, "pack_id": v.pack_id, "status": v.status, "approved": v.approved, "published": v.published}


@router.post("/videos/{vid}/approve")
def approve_video(vid: str, user=Depends(teacher)):
    with transaction() as s:
        v = s.get(TeacherVideo, vid)
        if not v or v.owner_id != user: raise HTTPException(404, "Video not found")
        if not v.pack_id: raise HTTPException(409, "Attach the video to a pack first")
        pack = s.get(Unit, v.pack_id)
        if not pack or pack.owner_id != user: raise HTTPException(404, "Pack not found")
        v.approved = True
        # If the pack is already published, approving this attached video is
        # the final gate needed to make it visible. Otherwise publication will
        # set published=True later.
        v.published = bool(pack.published_at)
        return {"id": v.id, "approved": True, "published": v.published}


@router.get("/videos/{vid}/download")
def video_download(vid: str, user=Depends(teacher)):
    with transaction() as s:
        v = s.get(TeacherVideo, vid)
        if not v or v.owner_id != user: raise HTTPException(404, "Video not found")
        try: return get_store("media").create_download_url(v.storage_key, expires=60)
        except Exception as exc: raise HTTPException(502, "Video preview unavailable") from exc


@router.post("/video-jobs", status_code=202)
@rate_limit("video", capacity=3, refill_per_second=1 / 120)
def video(body: VideoInput, user=Depends(teacher)):
    with transaction() as s:
        u = owned(s, body.pack_id, user, True)
        row = next(
            ((a, v) for a, v in current_versions(s, u.id) if a.slot == "video_script"),
            None,
        )
        if body.avatar_id:
            avatar = s.get(Avatar, body.avatar_id)
            if not avatar or avatar.owner_id != user:
                raise HTTPException(404, "Avatar not found")
        if (
            not row
            or row[1].state != "APPROVED"
            or row[1].source_revision != u.source_revision
        ):
            raise HTTPException(
                409, "Approve the current video script before rendering."
            )
        job = queue(s, u, "video")
        v = VideoJob(unit_id=u.id, script_version_id=row[1].id, avatar_id=body.avatar_id, job_id=job["id"])
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


@router.post("/packs/{pid}/resources/custom")
def add_custom_resource(pid: str, body: CustomResourceInput, user=Depends(teacher)):
    parsed = urlparse(body.url.strip())
    host = parsed.netloc.lower().split(":")[0]
    video_id = parse_qs(parsed.query).get("v", [None])[0]
    if host in {"youtu.be", "www.youtu.be"}:
        video_id = parsed.path.strip("/").split("/")[0]
    elif host in {"youtube.com", "www.youtube.com", "m.youtube.com"} and parsed.path.startswith("/shorts/"):
        video_id = parsed.path.split("/")[2] if len(parsed.path.split("/")) > 2 else None
    if host not in {"youtu.be", "www.youtu.be", "youtube.com", "www.youtube.com", "m.youtube.com"} or not video_id or len(video_id) > 80:
        raise HTTPException(422, "Enter a valid YouTube watch, youtu.be, or Shorts URL")
    title = body.title.strip() if body.title else "YouTube resource"
    channel = "Teacher-added link"
    key = os.getenv("YOUTUBE_API_KEY")
    if key:
        try:
            response = httpx.get("https://www.googleapis.com/youtube/v3/videos", params={"key":key,"part":"snippet","id":video_id}, timeout=15)
            if response.is_success and response.json().get("items"):
                snippet = response.json()["items"][0]["snippet"]
                title = title if body.title else snippet.get("title", title)
                channel = snippet.get("channelTitle", channel)
        except Exception:
            pass
    with transaction() as s:
        owned(s, pid, user)
        resource = s.scalar(select(Resource).where(Resource.unit_id == pid, Resource.video_id == video_id))
        if resource:
            raise HTTPException(409, "That YouTube video is already in this pack")
        resource = Resource(unit_id=pid, video_id=video_id, title=title, channel=channel)
        s.add(resource); s.flush()
        return {"id": resource.id, "title": resource.title, "channel": resource.channel, "url": f"https://www.youtube.com/watch?v={video_id}", "approved": False}


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
