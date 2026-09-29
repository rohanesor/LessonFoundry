from sqlalchemy import select
from fastapi import HTTPException
from app.models.entities import *


def owned(s, pack_id, user, lock=False):
    q = select(Unit).where(Unit.id == pack_id, Unit.owner_id == user)
    if lock:
        q = q.with_for_update()
    u = s.scalar(q)
    if not u:
        raise HTTPException(404, "Learning pack not found")
    return u


def evidence_rows(s, unit_id, current=True):
    q = (
        select(Evidence, Chunk, SourceVersion, Source)
        .join(Chunk, Evidence.chunk_id == Chunk.id)
        .join(SourceVersion, Chunk.source_version_id == SourceVersion.id)
        .join(Source, SourceVersion.source_id == Source.id)
        .where(Source.unit_id == unit_id)
    )
    if current:
        q = q.where(SourceVersion.number == Source.current_version)
    return [
        dict(
            id=e.id,
            chunk_id=c.id,
            text=c.text,
            location=c.location,
            source_id=d.id,
            source_name=d.name,
            source_version=v.number,
            source_version_id=v.id,
            hash=v.hash,
            created_at=v.created_at,
        )
        for e, c, v, d in s.execute(q)
    ]


def current_versions(s, unit_id):
    return list(
        s.execute(
            select(Asset, AssetVersion)
            .join(
                AssetVersion,
                (AssetVersion.asset_id == Asset.id)
                & (AssetVersion.number == Asset.current_number),
            )
            .where(Asset.unit_id == unit_id)
        ).all()
    )


def asset_dict(s, a, v, u):
    approval = s.scalar(select(Approval).where(Approval.version_id == v.id))
    return dict(
        id=a.id,
        slot=a.slot,
        version_id=v.id,
        version=v.number,
        objective_id=v.objective_id,
        payload=v.payload,
        state=v.state,
        source_revision=v.source_revision,
        stale=v.source_revision != u.source_revision,
        model=v.model,
        settings=v.settings,
        created_at=v.created_at,
        change_type=v.change_type,
        approval=(
            {"by": approval.user_id, "at": approval.created_at, "note": approval.note}
            if approval
            else None
        ),
        checks=[
            dict(name=c.name, state=c.state, detail=c.detail)
            for c in s.scalars(select(Check).where(Check.version_id == v.id))
        ],
    )


def pack_dict(s, u):
    objectives = []
    for o in s.scalars(
        select(Objective).where(Objective.unit_id == u.id).order_by(Objective.position)
    ):
        objectives.append(
            dict(
                id=o.id,
                description=o.description,
                position=o.position,
                status=o.status,
                reason=o.reason,
                evidence_ids=list(
                    s.scalars(
                        select(ObjectiveEvidence.evidence_id).where(
                            ObjectiveEvidence.objective_id == o.id
                        )
                    )
                ),
            )
        )
    return dict(
        id=u.id,
        title=u.title,
        subject=u.subject,
        level=u.level,
        exam=u.exam,
        summary=u.summary,
        constraints=u.constraints,
        revision=u.revision,
        source_revision=u.source_revision,
        share_token=u.share_token,
        classroom_id=u.classroom_id,
        published_at=u.published_at,
        objectives=objectives,
        evidence=evidence_rows(s, u.id),
        sources=[
            dict(
                id=d.id,
                name=d.name,
                version=d.current_version,
                has_original=bool(
                    s.scalar(
                        select(SourceVersion.storage_key).where(
                            SourceVersion.source_id == d.id,
                            SourceVersion.number == d.current_version,
                        )
                    )
                ),
            )
            for d in s.scalars(select(Source).where(Source.unit_id == u.id))
        ],
        assets=[asset_dict(s, a, v, u) for a, v in current_versions(s, u.id)],
        jobs=[
            dict(id=j.id, kind=j.kind, state=j.state, message=j.message)
            for j in s.scalars(
                select(Job)
                .where(Job.unit_id == u.id)
                .order_by(Job.created_at.desc())
                .limit(8)
            )
        ],
        videos=[
            dict(
                id=v.id,
                script_version_id=v.script_version_id,
                state=v.state,
                provider=v.provider,
                url=v.url,
            )
            for v in s.scalars(select(VideoJob).where(VideoJob.unit_id == u.id))
        ],
    )
