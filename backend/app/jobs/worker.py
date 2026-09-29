"""Durable DB queue, single local worker. PostgreSQL supports multiple workers via SKIP LOCKED."""

import os, time, logging
from datetime import datetime, timezone
from sqlalchemy import select, update, delete
from app.database import worker_transaction as transaction
from app.models.entities import *
from app.models.entities import Export, now
from app.observability import log_job
from app.repositories.packs import pack_dict, owned, current_versions
from app.services.packs import new_version, event
from app.providers.llm import provider, SLOTS
from app.providers.video import MockVideoGenerationProvider, VideoGenerationInput
from app.services.export import render_pack_pdf


def run_job(jid):
    started_at = datetime.now(timezone.utc)
    user_id = "unknown"
    try:
        with transaction() as s:
            j = s.get(Job, jid)
            u = s.get(Unit, j.unit_id)
            user_id = u.owner_id
            data = pack_dict(s, u)
            kind = j.kind
            aid = j.asset_id
            expected = j.expected_revision
            export_id = None
            if kind == "export":
                exp = s.scalar(
                    select(Export)
                    .where(Export.unit_id == u.id, Export.status.in_(["queued", "pending"]))
                    .order_by(Export.created_at.desc())
                )
                if not exp:
                    raise ValueError("Queued export record not found")
                exp.status = "processing"
                export_id = exp.id
        llm = provider()
        if kind == "gap":
            if not data["evidence"]:
                raise ValueError("Upload a source before checking objectives.")
            result = llm.map_objectives(data["objectives"], data["evidence"])
            if {r["objective_id"] for r in result} != {
                o["id"] for o in data["objectives"]
            } or len(result) != len(data["objectives"]):
                raise ValueError("Invalid objective mapping response")
            valid = {e["id"] for e in data["evidence"]}
            for r in result:
                if (
                    type(r["supported"]) is not bool
                    or not set(r["evidence_ids"]) <= valid
                    or (r["supported"] and not r["evidence_ids"])
                ):
                    raise ValueError("Invalid support evidence in model response")
        elif kind == "export":
            result = render_pack_pdf(data, export_id)
        elif kind == "video":
            with transaction() as s:
                v = s.scalar(select(VideoJob).where(VideoJob.job_id == jid))
                v.state = "Rendering"
                script = s.get(AssetVersion, v.script_version_id)
                if (
                    script.state != "APPROVED"
                    or script.source_revision != data["source_revision"]
                ):
                    raise ValueError("Script must be approved and current")
                text = script.payload["body"]
            result = MockVideoGenerationProvider().create_video(VideoGenerationInput(
                script_text=text, avatar_id=v.avatar_id, pack_id=v.unit_id, user_id=user_id
            ))
            result = {"state": result.state, "url": result.url, "message": result.message, "is_demo": result.is_demo}
        else:
            objectives = [o for o in data["objectives"] if o["status"] == "SUPPORTED"]
            if not objectives:
                raise ValueError(
                    "No supported objectives. Run gap check and revise unsupported objectives."
                )
            target = next((a for a in data["assets"] if a["id"] == aid), None)
            result = llm.generate(
                {
                    "slots": [target["slot"]] if target else SLOTS,
                    "objectives": [
                        o
                        for o in objectives
                        if not target or o["id"] == target["objective_id"]
                    ],
                    "evidence": data["evidence"],
                    "contract": data["constraints"],
                    "variant": target["version"] if target else 0,
                }
            )
            wanted = [target["slot"]] if target else SLOTS
            if sorted(p["slot"] for p in result) != sorted(wanted):
                raise ValueError("Model returned missing or duplicate asset slots")
        with transaction() as s:
            j = s.get(Job, jid)
            u = s.scalar(select(Unit).where(Unit.id == j.unit_id).with_for_update())
            if j.state == "Cancelled":
                return
            if u.revision != expected:
                raise ValueError(
                    "Pack changed while processing. No generated content was committed; retry."
                )
            if kind == "gap":
                for r in result:
                    o = s.get(Objective, r["objective_id"])
                    o.status = "SUPPORTED" if r["supported"] else "GAP"
                    o.reason = r["reason"]
                    s.execute(
                        delete(ObjectiveEvidence).where(
                            ObjectiveEvidence.objective_id == o.id
                        )
                    )
                    for eid in set(r["evidence_ids"]):
                        s.add(ObjectiveEvidence(objective_id=o.id, evidence_id=eid))
                event(
                    s,
                    u,
                    "Evidence mapping completed",
                    "Unsupported objectives remain blocked. Review support judgments before approval.",
                )
            elif kind == "export":
                exp = s.get(Export, export_id)
                if exp:
                    exp.status = "completed"
                    exp.storage_key = result.get("storage_key")
                    exp.file_size = result.get("file_size")
                    exp.mime_type = result.get("mime_type", "application/pdf")
                    exp.error = None
                    exp.completed_at = now()
                j.message = "Export ready for download."
                event(s, u, "Learning pack exported", "PDF available for student download.")
            elif kind == "video":
                v = s.scalar(select(VideoJob).where(VideoJob.job_id == jid))
                v.state = result["state"]
                v.url = result["url"]
                j.message = result["message"]
                event(s, u, "Mock video workflow completed", result["message"])
            else:
                changed = []
                for p in result:
                    a = s.scalar(
                        select(Asset).where(
                            Asset.unit_id == u.id, Asset.slot == p["slot"]
                        )
                    )
                    if not a:
                        a = Asset(unit_id=u.id, slot=p["slot"], current_number=0)
                        s.add(a)
                        s.flush()
                    elif kind == "generate":
                        raise ValueError(
                            "Pack already exists; regenerate individual drafts instead"
                        )
                    else:
                        previous = s.scalar(
                            select(AssetVersion).where(
                                AssetVersion.asset_id == a.id,
                                AssetVersion.number == a.current_number,
                            )
                        )
                        if previous.state == "APPROVED":
                            raise ValueError(
                                "Approved asset is locked. Create a new draft version first."
                            )
                    new_version(
                        s,
                        u,
                        a,
                        p,
                        p["objective_id"],
                        llm.name,
                        "regenerated" if aid else "generated",
                    )
                    changed.append(a.slot)
                unchanged = [
                    a.slot
                    for a, _ in current_versions(s, u.id)
                    if a.slot not in changed
                ]
                event(
                    s,
                    u,
                    "Controlled regeneration" if aid else "Learning pack generated",
                    "Changed: "
                    + ", ".join(changed)
                    + ". Unchanged: "
                    + (", ".join(unchanged) or "none (initial generation)"),
                )
            j.state = "Succeeded"
            if kind != "video":
                j.message = "Completed. Review evidence and validation before approval."
        log_job(
            job_id=jid,
            job_type=kind,
            unit_id=u.id,
            user_id=user_id,
            status="Succeeded",
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
        )
    except Exception as e:
        logging.exception("Job failed: %s", jid)
        with transaction() as s:
            j = s.get(Job, jid)
            if j and j.state != "Cancelled":
                j.state = "Failed"
                j.message = str(e)[:500]
                v = s.scalar(select(VideoJob).where(VideoJob.job_id == jid))
                if v:
                    v.state = "Failed"
                if j and j.kind == "export":
                    exp = s.scalar(
                        select(Export).where(Export.unit_id == j.unit_id).order_by(Export.created_at.desc())
                    )
                    if exp:
                        exp.status = "failed"
                        exp.error = "PDF export failed; inspect protected worker logs."
        log_job(
            job_id=jid,
            job_type=kind,
            unit_id=u.id,
            user_id=user_id,
            status="Failed",
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
            error=str(e)[:500],
        )


def tick():
    with transaction() as s:
        j = s.scalar(
            select(Job)
            .where(Job.state == "Queued")
            .order_by(Job.created_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if not j:
            return False
        jid = j.id
        changed = s.execute(
            update(Job)
            .where(Job.id == jid, Job.state == "Queued")
            .values(state="Running", message="Processing trusted evidence…")
        )
        if not changed.rowcount:
            return False
    run_job(jid)
    return True


def main():
    from app.config import log_configuration_status, validate_configuration
    from app.database import Base, engine

    validate_configuration()
    log_configuration_status()
    if os.getenv("AUTH_MODE") != "supabase": 
        # In local mode, both API and worker may create tables idempotently.
        Base.metadata.create_all(engine, checkfirst=True)
    while True:
        if not tick():
            time.sleep(1)


if __name__ == "__main__":
    main()
