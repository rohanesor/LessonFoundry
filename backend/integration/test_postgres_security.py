"""Real PostgreSQL/RLS, local Auth/Storage SQL shims. NOT managed Supabase evidence.
Run separately from backend/tests (which intentionally chooses SQLite).
"""

import os, json
from uuid import uuid4
import pytest

if not os.getenv("LF_TEST_ADMIN_DATABASE_URL"):
    pytest.skip(
        "Explicit isolated PostgreSQL admin connection required",
        allow_module_level=True,
    )
import psycopg
from psycopg import sql
from fastapi.testclient import TestClient
from app.main import app
from app.api import auth
from app.database import transaction, worker_session
from app.security import Identity, identity
from app.jobs.worker import tick
from sqlalchemy import text
from app.seed import SOURCE

ADMIN = os.environ["LF_TEST_ADMIN_DATABASE_URL"]


@pytest.fixture
def tenants(monkeypatch):
    a, b = str(uuid4()), str(uuid4())
    with psycopg.connect(ADMIN) as c:
        c.execute("INSERT INTO auth.users(id) VALUES (%s),(%s)", (a, b))

    def verified(token, required_role=None):
        if token not in (a, b):
            from fastapi import HTTPException

            raise HTTPException(401, "Invalid test session")
        return token, "teacher"

    monkeypatch.setattr(auth, "verify_session", verified)
    with TestClient(app) as client:

        def create(uid):
            h = {"Authorization": "Bearer " + uid}
            r = client.post(
                "/api/packs",
                headers=h,
                json={
                    "title": "PostgreSQL isolation " + uid[:6],
                    "objectives": [
                        "Explain Newton force laws",
                        "Solve acceleration problems",
                    ],
                },
            )
            assert r.status_code == 201, r.text
            pid = r.json()["id"]
            r = client.post(
                f"/api/packs/{pid}/sources/text",
                headers=h,
                json={"name": "Trusted notes", "text": SOURCE},
            )
            assert r.status_code == 200, r.text
            client.post(f"/api/packs/{pid}/gap-check", headers=h)
            assert tick()
            client.post(f"/api/packs/{pid}/generate", headers=h)
            assert tick()
            p = client.get(f"/api/packs/{pid}", headers=h).json()
            assert len(p["assets"]) == 11, p["jobs"]
            return h, p

        ha, pa = create(a)
        hb, pb = create(b)
        yield client, a, b, ha, hb, pa, pb


def scoped(user, statement, params=(), role="lessonfoundry_api"):
    with psycopg.connect(ADMIN) as c:
        c.execute(sql.SQL("SET LOCAL ROLE {}").format(sql.Identifier(role)))
        c.execute(
            "SELECT set_config('request.jwt.claims',%s,true)",
            (
                json.dumps(
                    {
                        "sub": user,
                        "role": "authenticated",
                        "app_metadata": {"role": "teacher"},
                    }
                ),
            ),
        )
        return c.execute(statement, params).fetchall()


def test_postgres_tenant_reads_all_tables(tenants):
    c, a, b, ha, hb, pa, pb = tenants
    tables = [
        "users",
        "units",
        "source_documents",
        "source_versions",
        "source_chunks",
        "evidence",
        "objectives",
        "objective_evidence",
        "assets",
        "asset_versions",
        "asset_evidence",
        "claims",
        "claim_evidence",
        "quality_checks",
        "pack_events",
        "jobs",
    ]
    for table in tables:
        qa = scoped(a, sql.SQL("SELECT * FROM public.{}").format(sql.Identifier(table)))
        qb = scoped(b, sql.SQL("SELECT * FROM public.{}").format(sql.Identifier(table)))
        assert qa and qb, table
        # Tenant-specific PK/FK data must be disjoint (timestamps alone aren't compared).
        cols = scoped(
            a,
            sql.SQL("SELECT to_jsonb(t) FROM public.{} t").format(
                sql.Identifier(table)
            ),
        )
        other = scoped(
            b,
            sql.SQL("SELECT to_jsonb(t) FROM public.{} t").format(
                sql.Identifier(table)
            ),
        )

        def key(row):
            d = row[0]
            return d.get("id") or tuple(d[k] for k in sorted(d) if k.endswith("_id"))

        assert not set(map(key, cols)) & set(map(key, other)), table
    assert c.get("/api/packs/" + pa["id"], headers=hb).status_code == 404
    for route in [
        f"/assets/{pa['assets'][0]['id']}",
        f"/assets/{pa['assets'][0]['id']}/versions",
        f"/assets/{pa['assets'][0]['id']}/evidence",
        f"/packs/{pa['id']}/validation",
        f"/packs/{pa['id']}/status",
        f"/packs/{pa['id']}/resources",
    ]:
        assert c.get("/api" + route, headers=hb).status_code == 404, route


def test_postgres_insert_update_delete_policies(tenants):
    _, a, b, _, _, pa, pb = tenants
    # INSERT succeeds for A, rejects a B parent, UPDATE and DELETE can't touch B rows.
    insert = "INSERT INTO resources(id,unit_id,video_id,title,channel,approved) VALUES (%s,%s,%s,%s,%s,false) RETURNING id"
    rid = str(uuid4())
    assert scoped(a, insert, (rid, pa["id"], "test-video", "Original", "Test")) == [
        (rid,)
    ]
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        scoped(a, insert, (str(uuid4()), pb["id"], "attack", "Forbidden", "Test"))
    assert scoped(
        a, "UPDATE resources SET title=%s WHERE id=%s RETURNING id", ("Edited", rid)
    ) == [(rid,)]
    assert (
        scoped(
            b,
            "UPDATE resources SET title=%s WHERE id=%s RETURNING id",
            ("Forbidden", rid),
        )
        == []
    )
    assert scoped(b, "DELETE FROM resources WHERE id=%s RETURNING id", (rid,)) == []
    assert scoped(a, "DELETE FROM resources WHERE id=%s RETURNING id", (rid,)) == [
        (rid,)
    ]
    # Browser role is read-only: even owner's write must go through API lifecycle checks.
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        scoped(
            a,
            "UPDATE units SET title=%s WHERE id=%s RETURNING id",
            ("Bypass", pa["id"]),
            role="authenticated",
        )
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        scoped(
            a, "UPDATE units SET owner_id=%s WHERE id=%s RETURNING id", (b, pa["id"])
        )


def test_link_tables_reject_cross_tenant_evidence(tenants):
    _, a, b, _, _, pa, pb = tenants
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        scoped(
            a,
            "INSERT INTO asset_evidence(version_id,evidence_id) VALUES (%s,%s) RETURNING version_id",
            (pa["assets"][0]["version_id"], pb["evidence"][0]["id"]),
        )


def test_regeneration_approval_persistence_and_db_lock(tenants):
    c, a, b, ha, hb, pa, pb = tenants
    q3 = next(x for x in pa["assets"] if x["slot"] == "quiz3")
    assert (
        c.post("/api/assets/" + q3["id"] + "/regenerate", headers=ha).status_code == 202
    )
    tick()
    p = c.get("/api/packs/" + pa["id"], headers=ha).json()
    for new, old in zip(p["assets"], pa["assets"]):
        assert (new["version_id"] != old["version_id"]) == (new["slot"] == "quiz3")
    assert c.get("/api/student/" + p["share_token"]).json()["assets"] == []
    r = c.post(
        "/api/packs/" + p["id"] + "/approve",
        headers=ha,
        json={
            "note": "Reviewed source, answers and remaining semantic checks.",
            "expected_revision": p["revision"],
        },
    )
    assert r.status_code == 200, r.text
    reloaded = c.get("/api/packs/" + pa["id"], headers=ha).json()
    assert all(x["state"] == "APPROVED" for x in reloaded["assets"])
    assert len(c.get("/api/student/" + p["share_token"]).json()["assets"]) == 10
    asset = reloaded["assets"][0]
    assert (
        c.patch(
            "/api/assets/" + asset["id"],
            headers=ha,
            json={"expected_version": asset["version"], "payload": asset["payload"]},
        ).status_code
        == 409
    )
    assert (
        c.post("/api/assets/" + asset["id"] + "/regenerate", headers=ha).status_code
        == 409
    )
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        scoped(
            a,
            "UPDATE asset_versions SET state='DRAFT' WHERE id=%s RETURNING id",
            (asset["version_id"],),
        )
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        scoped(
            a,
            "DELETE FROM asset_versions WHERE id=%s RETURNING id",
            (asset["version_id"],),
        )
    assert scoped(b, "SELECT id FROM approvals") == []
    assert scoped(a, "SELECT id FROM approvals")


def test_local_storage_policy_shim(tenants):
    _, a, b, _, _, pa, pb = tenants
    path = f"{a}/{pa['id']}/{uuid4()}/lesson.pdf"
    insert = "INSERT INTO storage.objects(bucket_id,name) VALUES ('sources',%s) RETURNING name"
    assert scoped(a, insert, (path,), role="authenticated") == [(path,)]
    assert scoped(
        a,
        "SELECT name FROM storage.objects WHERE name=%s",
        (path,),
        role="authenticated",
    ) == [(path,)]
    assert (
        scoped(
            b,
            "SELECT name FROM storage.objects WHERE name=%s",
            (path,),
            role="authenticated",
        )
        == []
    )
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        scoped(b, insert, (path + "-guessed",), role="authenticated")
    # User A's prefix cannot be attached to User B's pack either.
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        scoped(a, insert, (f"{a}/{pb['id']}/bad/file.pdf",), role="authenticated")
    assert (
        scoped(
            a,
            "UPDATE storage.objects SET name=%s WHERE name=%s RETURNING name",
            (path + "x", path),
            role="authenticated",
        )
        == []
    )
    assert (
        scoped(
            b,
            "DELETE FROM storage.objects WHERE name=%s RETURNING name",
            (path,),
            role="authenticated",
        )
        == []
    )
    assert scoped(
        a,
        "DELETE FROM storage.objects WHERE name=%s RETURNING name",
        (path,),
        role="authenticated",
    ) == [(path,)]


def test_transaction_identity_cannot_leak_between_requests(tenants):
    _, a, b, _, _, pa, pb = tenants
    for user, expected in [(a, pa["id"]), (b, pb["id"]), (a, pa["id"])]:
        h = identity.set(Identity(user, user))
        try:
            with transaction() as s:
                assert list(s.scalars(text("SELECT id FROM units"))) == [expected]
        finally:
            identity.reset(h)
    with transaction() as s:
        with pytest.raises(Exception):
            s.execute(text("SELECT * FROM units"))


def test_all_tables_deny_cross_user_insert_update_delete(tenants):
    """Negative DML is executed for every owned table, not inferred from SELECT."""
    from psycopg.types.json import Json

    c, a, b, ha, hb, pa, pb = tenants
    script = next(x for x in pb["assets"] if x["slot"] == "video_script")
    r = c.post(
        "/api/assets/" + script["id"] + "/approve",
        headers=hb,
        json={
            "expected_version": script["version"],
            "note": "Reviewed mock script for database isolation test.",
        },
    )
    assert r.status_code == 200
    assert (
        c.post("/api/video-jobs", headers=hb, json={"pack_id": pb["id"]}).status_code
        == 202
    )
    assert tick()
    scoped(
        b,
        "INSERT INTO resources(id,unit_id,video_id,title,channel,approved) VALUES (%s,%s,%s,%s,%s,false) RETURNING id",
        (str(uuid4()), pb["id"], str(uuid4()), "Test resource", "Test"),
    )
    scoped(
        b,
        "INSERT INTO classrooms(id,owner_id,name,join_code,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
        (str(uuid4()), b, "Test classroom", str(uuid4())[:8].upper(), "2026-09-29T16:00:00Z", "2026-09-29T16:00:00Z"),
    )
    with psycopg.connect(ADMIN) as conn:
        tables = [
            r[0]
            for r in conn.execute(
                "SELECT tablename FROM pg_policies WHERE schemaname='public' AND policyname LIKE '%_api_owner'"
            )
        ]
    assert len(tables) in (19, 20)
    for table in tables:
        row = scoped(
            b,
            sql.SQL("SELECT to_jsonb(t) FROM public.{} t LIMIT 1").format(
                sql.Identifier(table)
            ),
        )[0][0]
        pk = ["id"] if "id" in row else sorted(k for k in row if k.endswith("_id"))
        where = sql.SQL(" AND ").join(
            sql.SQL("{}=%s").format(sql.Identifier(k)) for k in pk
        )
        values = tuple(row[k] for k in pk)
        update = sql.SQL("UPDATE public.{} SET {}={} WHERE {} RETURNING {}").format(
            sql.Identifier(table),
            sql.Identifier(pk[0]),
            sql.Identifier(pk[0]),
            where,
            sql.Identifier(pk[0]),
        )
        delete = sql.SQL("DELETE FROM public.{} WHERE {} RETURNING {}").format(
            sql.Identifier(table), where, sql.Identifier(pk[0])
        )
        assert scoped(a, update, values) == [], table
        assert scoped(a, delete, values) == [], table
        # Keep B's foreign-key ownership path but avoid single-column PK conflicts.
        if "id" in row:
            row["id"] = str(uuid4())
        if "join_code" in row:
            row["join_code"] = str(uuid4())[:8].upper()
        columns = list(row)
        insert = sql.SQL("INSERT INTO public.{} ({}) VALUES ({}) RETURNING {}").format(
            sql.Identifier(table),
            sql.SQL(",").join(map(sql.Identifier, columns)),
            sql.SQL(",").join(sql.Placeholder() for _ in columns),
            sql.Identifier(pk[0]),
        )
        params = tuple(
            Json(row[k]) if isinstance(row[k], (dict, list)) else row[k]
            for k in columns
        )
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            scoped(a, insert, params)
