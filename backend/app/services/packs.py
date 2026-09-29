import hashlib
from sqlalchemy import select, delete
from fastapi import HTTPException
from app.models.entities import *
from app.repositories.packs import current_versions, evidence_rows
from app.validators.quality import CoreValidator
from app.schemas.contracts import Payload


def event(s, u, title, detail):
    u.revision += 1
    s.add(Timeline(unit_id=u.id, revision=u.revision, title=title, detail=detail))


def add_source(s, u, name, rows, raw, storage_key=None, source_id=None):
    d = s.get(Source, source_id) if source_id else None
    if source_id and (not d or d.unit_id != u.id):
        raise HTTPException(404, "Source not found in this pack")
    if d:
        d.current_version += 1
    else:
        d = Source(unit_id=u.id, name=name, current_version=1)
        s.add(d)
        s.flush()
    v = SourceVersion(
        source_id=d.id,
        number=d.current_version,
        hash=hashlib.sha256(raw).hexdigest(),
        storage_key=storage_key,
    )
    s.add(v)
    s.flush()
    for loc, text in rows:
        # Fixed bounded windows retain the original page/slide/paragraph attribution.
        for position, start in enumerate(range(0, len(text), 1800)):
            c = Chunk(
                source_version_id=v.id,
                text=text[start : start + 1800],
                location=loc,
                position=position,
            )
            s.add(c)
            s.flush()
            s.add(Evidence(chunk_id=c.id))
    u.source_revision += 1
    for o in s.scalars(select(Objective).where(Objective.unit_id == u.id)):
        o.status = "UNCHECKED"
        o.reason = "Source changed. Recheck support before generation."
        s.execute(
            delete(ObjectiveEvidence).where(ObjectiveEvidence.objective_id == o.id)
        )
    event(
        s,
        u,
        "Source uploaded" if not source_id else "Source replaced",
        f"{name} v{d.current_version}. Previous assets retain original evidence and are stale.",
    )
    return d


def new_version(s, u, a, p, objective_id, model, change, settings=None):
    p = Payload.model_validate(p).model_dump()
    ev = {e["id"]: e for e in evidence_rows(s, u.id)}
    if not set(p["evidence_ids"]) <= set(ev):
        raise ValueError(
            "Generated evidence references are missing or outside current source boundary"
        )
    objective = s.get(Objective, objective_id)
    if not objective or objective.unit_id != u.id or objective.status != "SUPPORTED":
        raise ValueError("Objective is unsupported; run gap check before generating")
    a.current_number += 1
    v = AssetVersion(
        asset_id=a.id,
        number=a.current_number,
        objective_id=objective_id,
        payload=p,
        source_revision=u.source_revision,
        model=model,
        settings=settings
        or {
            "temperature": 0.2,
            "prompt_version": "2.0",
            "contract": u.constraints,
            "objective_snapshot": objective.description,
        },
        change_type=change,
        created_by=u.owner_id,
        state="VALIDATING",
    )
    s.add(v)
    s.flush()
    for eid in set(p["evidence_ids"]):
        s.add(AssetEvidence(version_id=v.id, evidence_id=eid))
    for text in p["claims"]:
        claim = Claim(version_id=v.id, statement=text)
        s.add(claim)
        s.flush()
        for eid in set(p["evidence_ids"]):
            s.add(ClaimEvidence(claim_id=claim.id, evidence_id=eid))
    neighbors = [
        x.payload["body"] for other, x in current_versions(s, u.id) if other.id != a.id
    ]
    checks = CoreValidator().validate(
        p,
        {
            "slot": a.slot,
            "evidence": ev,
            "neighbors": neighbors,
            "max_words": int(u.constraints.get("max_words", 300)),
        },
    )
    for c in checks:
        s.add(Check(version_id=v.id, **c))
    v.state = "NEEDS REVIEW" if any(c["state"] != "PASS" for c in checks) else "READY"
    return v


def approve(s, u, a, v, user, note):
    if v.state == "APPROVED":
        return
    if v.source_revision != u.source_revision:
        raise HTTPException(
            409, "Source changed. Regenerate this asset before approval."
        )
    if s.scalar(select(Check).where(Check.version_id == v.id, Check.state == "FAIL")):
        raise HTTPException(
            409,
            "Resolve failing checks before approval. Warnings require explicit teacher review.",
        )
    v.state = "READY"
    s.flush()
    s.add(Approval(version_id=v.id, user_id=user, note=note))
    v.state = "APPROVED"
    a.published_number = v.number
