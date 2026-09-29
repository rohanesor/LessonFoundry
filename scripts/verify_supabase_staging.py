"""Opt-in live staging verification. Never prints JWTs, passwords, keys, object paths or URLs.
Configure .env.staging locally, then use --run (and --provision-users on first run).
Creates persistent test packs; use a dedicated staging project, never production.
"""

import argparse, json, os, sys, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, quote
from uuid import uuid4
import httpx
from dotenv import load_dotenv

RESULTS = []


def check(condition, name):
    RESULTS.append({"check": name, "status": "PASS" if condition else "FAIL"})
    if not condition:
        raise RuntimeError(name)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--provision-users", action="store_true")
    parser.add_argument(
        "--pdf", default="backend/integration/fixtures/newton-staging.pdf"
    )
    args = parser.parse_args()
    load_dotenv(".env.staging", override=False)
    needed = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_STAGING_PROJECT_REF",
        "STAGING_API_URL",
        "STAGING_USER_A_EMAIL",
        "STAGING_USER_A_PASSWORD",
        "STAGING_USER_B_EMAIL",
        "STAGING_USER_B_PASSWORD",
        "DATABASE_URL",
    ]
    if args.provision_users:
        needed.append("SUPABASE_SERVICE_ROLE_KEY")
    missing = [k for k in needed if not os.getenv(k)]
    if missing:
        print("BLOCKED: missing configuration names: " + ", ".join(missing))
        return 2
    url = os.environ["SUPABASE_URL"].rstrip("/")
    ref = os.environ["SUPABASE_STAGING_PROJECT_REF"]
    if urlparse(url).hostname != ref + ".supabase.co":
        print("BLOCKED: staging project reference does not match Supabase URL")
        return 2
    if not args.run:
        print(
            "Configuration present. No network operations executed; pass --run for live verification."
        )
        return 0
    public = os.environ["SUPABASE_ANON_KEY"]
    base = os.environ["STAGING_API_URL"].rstrip("/")
    with httpx.Client(timeout=45) as client:

        def checked_request(method, url, **kw):
            r = client.request(method, url, **kw)
            check(r.is_success, "HTTP operation accepted")
            return r

        tokens = []
        for user in ["A", "B"]:
            email = os.environ[f"STAGING_USER_{user}_EMAIL"]
            password = os.environ[f"STAGING_USER_{user}_PASSWORD"]
            if args.provision_users:
                secret = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
                r = client.post(
                    url + "/auth/v1/admin/users",
                    headers={"apikey": secret, "Authorization": "Bearer " + secret},
                    json={
                        "email": email,
                        "password": password,
                        "email_confirm": True,
                        "app_metadata": {"role": "teacher"},
                    },
                )
                check(r.is_success, f"Provision staging teacher {user}")
            r = client.post(
                url + "/auth/v1/token?grant_type=password",
                headers={"apikey": public},
                json={"email": email, "password": password},
            )
            check(r.is_success, f"Sign in teacher {user}")
            data = r.json()
            tokens.append(
                (data["access_token"], data["user"]["id"], data["refresh_token"])
            )
        check(tokens[0][1] != tokens[1][1], "Two distinct authenticated teachers")
        h = [{"Authorization": "Bearer " + t[0]} for t in tokens]
        rh = [{"Authorization": "Bearer " + t[0], "apikey": public} for t in tokens]
        check(
            client.get(base + "/api/packs").status_code == 401,
            "Unauthenticated API request rejected",
        )
        health = client.get(base + "/api/health").json()
        check(
            health.get("auth") == "supabase", "API uses Supabase auth, not local tokens"
        )
        check(
            health.get("provider") == "mock",
            "Persistence verification uses explicit mock generation (no paid calls)",
        )
        packs = []
        pdf = Path(args.pdf).read_bytes()
        for i in range(2):
            r = checked_request(
                "POST",
                base + "/api/packs",
                headers=h[i],
                json={
                    "title": "Staging verification " + uuid4().hex[:8],
                    "objectives": [
                        "Explain Newton's force laws",
                        "Solve force and acceleration problems",
                    ],
                },
            )
            pid = r.json()["id"]
            r = checked_request(
                "POST",
                base + f"/api/packs/{pid}/sources",
                headers=h[i],
                files={"file": ("staging-source.pdf", pdf, "application/pdf")},
            )
            pack = checked_request(
                "GET", base + f"/api/packs/{pid}", headers=h[i]
            ).json()
            packs.append(pack)
            check(
                bool(pack["evidence"])
                and all(e["location"].startswith("Page ") for e in pack["evidence"]),
                f"PDF extraction, chunks and persisted evidence for teacher {i + 1}",
            )
        pa, pb = packs
        for i, p in enumerate(packs):
            other = 1 - i
            check(
                client.get(base + "/api/packs/" + p["id"], headers=h[other]).status_code
                == 404,
                "Cross-user pack API denied",
            )
            sid = p["sources"][0]["id"]
            number = p["sources"][0]["version"]
            dl = f"/api/sources/{sid}/versions/{number}/download"
            check(
                client.get(base + dl, headers=h[other]).status_code == 404,
                "Cross-user signed URL request denied",
            )
            signed = checked_request("GET", base + dl, headers=h[i]).json()
            check(
                signed["expires_in"] == 60,
                "Original-file signed URL expires after 60 seconds",
            )
            check(
                client.get(signed["url"]).content == pdf,
                "Owner signed download matches uploaded bytes",
            )
            version_id = p["evidence"][0]["source_version_id"]
            path = checked_request(
                "GET",
                url + "/rest/v1/source_versions",
                headers=rh[i],
                params={"id": "eq." + version_id, "select": "storage_key"},
            ).json()[0]["storage_key"]
            obj = (
                url
                + "/storage/v1/object/authenticated/sources/"
                + quote(path, safe="/")
            )
            check(
                client.get(obj, headers=rh[i]).content == pdf,
                "Owner authenticated original-file read",
            )
            check(
                not client.get(obj, headers=rh[other]).is_success,
                "Guessed other-user object path denied",
            )
            check(
                not client.get(
                    url + "/storage/v1/object/public/sources/" + quote(path, safe="/")
                ).is_success,
                "Source object is not publicly readable",
            )
            r = client.post(
                url + "/storage/v1/object/sign/sources/" + quote(path, safe="/"),
                headers=rh[other],
                json={"expiresIn": 60},
            )
            check(
                not r.is_success,
                "Other teacher cannot directly sign a guessed object path",
            )

        def wait(pid, actor=0):
            for _ in range(120):
                p = checked_request(
                    "GET", base + "/api/packs/" + pid, headers=h[actor]
                ).json()
                if p["jobs"][0]["state"] in ("Succeeded", "Failed", "Cancelled"):
                    check(
                        p["jobs"][0]["state"] == "Succeeded",
                        "Background job completed against persisted staging state",
                    )
                    return p
                time.sleep(1)
            check(False, "Worker completed within 120 seconds")

        pid = pa["id"]
        checked_request("POST", base + f"/api/packs/{pid}/gap-check", headers=h[0])
        wait(pid)
        checked_request("POST", base + f"/api/packs/{pid}/generate", headers=h[0])
        p = wait(pid)
        a = next(x for x in p["assets"] if x["slot"] == "explanation")
        payload = {**a["payload"], "title": "Persisted explanation edit"}
        checked_request(
            "PATCH",
            base + "/api/assets/" + a["id"],
            headers=h[0],
            json={"expected_version": a["version"], "payload": payload},
        )
        # Fresh auth session restoration/refresh, then a new API read (browser reload is a separate test).
        refresh = client.post(
            url + "/auth/v1/token?grant_type=refresh_token",
            headers={"apikey": public},
            json={"refresh_token": tokens[0][2]},
        )
        check(
            refresh.is_success, "Supabase refresh token restores authenticated session"
        )
        h[0] = {"Authorization": "Bearer " + refresh.json()["access_token"]}
        rh[0] = {**h[0], "apikey": public}
        p = checked_request("GET", base + f"/api/packs/{pid}", headers=h[0]).json()
        check(
            any(
                x["payload"]["title"] == "Persisted explanation edit"
                for x in p["assets"]
            ),
            "Asset edit persists across fresh authenticated request",
        )
        q3 = next(x for x in p["assets"] if x["slot"] == "quiz3")
        before = {x["slot"]: x["version_id"] for x in p["assets"]}
        checked_request(
            "POST", base + "/api/assets/" + q3["id"] + "/regenerate", headers=h[0]
        )
        p = wait(pid)
        for x in p["assets"]:
            check(
                (before[x["slot"]] != x["version_id"]) == (x["slot"] == "quiz3"),
                "Regeneration changes only Q3: " + x["slot"],
            )
        history = checked_request(
            "GET", base + f"/api/packs/{pid}/versions", headers=h[0]
        ).json()
        check(any("quiz3" in x["detail"] for x in history), "Version history persisted")
        check(
            client.get(base + "/api/student/" + p["share_token"]).json()["assets"]
            == [],
            "Draft assets unavailable to student API",
        )
        checked_request(
            "POST",
            base + f"/api/packs/{pid}/approve",
            headers=h[0],
            json={
                "expected_revision": p["revision"],
                "note": "Staging verification: source support, answers and warnings explicitly reviewed.",
            },
        )
        p = checked_request("GET", base + f"/api/packs/{pid}", headers=h[0]).json()
        check(
            all(x["state"] == "APPROVED" for x in p["assets"]),
            "Approval and locks persist",
        )
        for x in p["assets"]:
            check(
                client.post(
                    base + "/api/assets/" + x["id"] + "/regenerate", headers=h[0]
                ).status_code
                == 409,
                "Approved regeneration rejected server-side",
            )
            check(
                client.patch(
                    base + "/api/assets/" + x["id"],
                    headers=h[0],
                    json={"expected_version": x["version"], "payload": x["payload"]},
                ).status_code
                == 409,
                "Approved edit rejected server-side",
            )
        st = client.get(base + "/api/student/" + p["share_token"]).json()
        check(
            bool(st["assets"])
            and all(
                not {"answer", "solution", "checks", "evidence_ids"} & x.keys()
                for x in st["assets"]
            ),
            "Student API returns approved allowlist without teacher-only fields",
        )
        # Exercise real PostgREST reads and write denials without service-role bypass.
        rows = {
            "units": pid,
            "assets": p["assets"][0]["id"],
            "asset_versions": p["assets"][0]["version_id"],
            "source_documents": pa["sources"][0]["id"],
            "source_versions": pa["evidence"][0]["source_version_id"],
            "source_chunks": pa["evidence"][0]["chunk_id"],
            "evidence": pa["evidence"][0]["id"],
            "objectives": p["objectives"][0]["id"],
        }
        for table, rowid in rows.items():
            for i in range(2):
                r = client.get(
                    url + "/rest/v1/" + table,
                    headers=rh[i],
                    params={"id": "eq." + rowid, "select": "id"},
                )
                check(
                    r.is_success and bool(r.json()) == (i == 0),
                    "PostgREST owner isolation: "
                    + table
                    + (" owner" if i == 0 else " other"),
                )
            for method, body in [
                ("POST", {"id": str(uuid4())}),
                ("PATCH", {"id": str(uuid4())}),
                ("DELETE", None),
            ]:
                r = client.request(
                    method,
                    url + "/rest/v1/" + table,
                    headers=rh[0],
                    params={"id": "eq." + rowid} if method != "POST" else None,
                    json=body,
                )
                check(
                    not r.is_success,
                    "Direct browser "
                    + method
                    + " denied; mutation requires API: "
                    + table,
                )
        # Populate both tenants' approval/video rows before asserting table-wide RLS.
        # These are the existing mock jobs, not a new avatar integration.
        for actor, current in enumerate([p, pb]):
            pack_id = current["id"]
            if actor == 1:
                checked_request(
                    "POST", base + f"/api/packs/{pack_id}/gap-check", headers=h[actor]
                )
                wait(pack_id, actor)
                checked_request(
                    "POST", base + f"/api/packs/{pack_id}/generate", headers=h[actor]
                )
                current = wait(pack_id, actor)
                script = next(
                    x for x in current["assets"] if x["slot"] == "video_script"
                )
                checked_request(
                    "POST",
                    base + "/api/assets/" + script["id"] + "/approve",
                    headers=h[actor],
                    json={
                        "expected_version": script["version"],
                        "note": "Reviewed mock staging script for persistence and isolation checks.",
                    },
                )
            video = checked_request(
                "POST",
                base + "/api/video-jobs",
                headers=h[actor],
                json={"pack_id": pack_id},
            ).json()
            wait(pack_id, actor)
            check(
                client.get(
                    base + "/api/video-jobs/" + video["id"], headers=h[1 - actor]
                ).status_code
                == 404,
                "Cross-user video-job access denied",
            )
        verify_rls_sql(tokens[0][1], tokens[1][1], pa["id"], pb["id"])
    return 0


def verify_rls_sql(a, b, pa, pb):
    import psycopg
    from psycopg import sql

    dsn = os.environ["DATABASE_URL"].replace(
        "postgresql+psycopg://", "postgresql://", 1
    )

    def scoped(user, statement, params=()):
        with psycopg.connect(dsn) as c:
            c.execute("SET LOCAL ROLE lessonfoundry_api")
            c.execute(
                "SELECT set_config('request.jwt.claims',%s,true)",
                (json.dumps({"sub": user}),),
            )
            return c.execute(statement, params).fetchall()

    with psycopg.connect(dsn) as c:
        tables = c.execute(
            "SELECT tablename FROM pg_policies WHERE schemaname='public' AND policyname LIKE '%_api_owner'"
        ).fetchall()
        check(len(tables) == 19, "Explicit API ownership policies on all 19 tables")
        rls = c.execute(
            "SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN (SELECT tablename FROM pg_policies WHERE policyname LIKE '%_api_owner')"
        ).fetchone()[0]
        check(rls, "RLS enabled and forced on user-owned tables")
    # Provide non-empty resource rows for both tenants; no vacuous isolation passes.
    probe_resources = []
    for user, pack in [(a, pa), (b, pb)]:
        rid = str(uuid4())
        scoped(
            user,
            "INSERT INTO resources(id,unit_id,video_id,title,channel,approved) VALUES (%s,%s,%s,'RLS fixture','Staging',false) RETURNING id",
            (rid, pack, rid),
        )
        probe_resources.append((user, rid))
    for (table,) in tables:
        own = scoped(
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

        check(bool(own) and bool(other), "RLS fixtures exist for both users: " + table)
        check(
            not set(map(key, own)) & set(map(key, other)),
            "Direct SQL cross-user SELECT isolation: " + table,
        )
        # UPDATE/DELETE of B's actual row must affect zero rows, and INSERT
        # retaining B's parent path must be rejected by WITH CHECK on every table.
        from psycopg.types.json import Json

        row = other[0][0]
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
        check(scoped(a, update, values) == [], "Cross-user UPDATE denied: " + table)
        check(scoped(a, delete, values) == [], "Cross-user DELETE denied: " + table)
        if "id" in row:
            row["id"] = str(uuid4())
        columns = list(row)
        statement = sql.SQL(
            "INSERT INTO public.{} ({}) VALUES ({}) RETURNING {}"
        ).format(
            sql.Identifier(table),
            sql.SQL(",").join(map(sql.Identifier, columns)),
            sql.SQL(",").join(sql.Placeholder() for _ in columns),
            sql.Identifier(pk[0]),
        )
        values = tuple(
            Json(row[k]) if isinstance(row[k], (dict, list)) else row[k]
            for k in columns
        )
        denied = False
        try:
            scoped(a, statement, values)
        except psycopg.errors.InsufficientPrivilege:
            denied = True
        check(denied, "Cross-user INSERT denied: " + table)
    for user, rid in probe_resources:
        scoped(user, "DELETE FROM resources WHERE id=%s RETURNING id", (rid,))
    rid = str(uuid4())
    insert = "INSERT INTO resources(id,unit_id,video_id,title,channel,approved) VALUES (%s,%s,%s,%s,%s,false) RETURNING id"
    check(
        scoped(a, insert, (rid, pa, rid, "RLS probe", "Staging")) == [(rid,)],
        "RLS owner INSERT permitted through API role",
    )
    denied = False
    try:
        scoped(
            a, insert, (str(uuid4()), pb, str(uuid4()), "Cross-tenant probe", "Staging")
        )
    except psycopg.errors.InsufficientPrivilege:
        denied = True
    check(denied, "RLS cross-user INSERT denied")
    check(
        scoped(
            b,
            "UPDATE resources SET title=%s WHERE id=%s RETURNING id",
            ("Forbidden", rid),
        )
        == [],
        "RLS cross-user UPDATE denied",
    )
    check(
        scoped(
            a,
            "UPDATE resources SET title=%s WHERE id=%s RETURNING id",
            ("Verified", rid),
        )
        == [(rid,)],
        "RLS owner UPDATE permitted",
    )
    check(
        scoped(b, "DELETE FROM resources WHERE id=%s RETURNING id", (rid,)) == [],
        "RLS cross-user DELETE denied",
    )
    check(
        scoped(a, "DELETE FROM resources WHERE id=%s RETURNING id", (rid,)) == [(rid,)],
        "RLS owner DELETE permitted",
    )


if __name__ == "__main__":
    code = 1
    try:
        code = main()
    except Exception:
        # Never print raw HTTP/SQL exceptions: they may contain credentials or signed URLs.
        print(
            "FAIL: live verification stopped. Inspect the named check in the redacted report."
        )
        if not RESULTS or RESULTS[-1]["status"] != "FAIL":
            RESULTS.append(
                {"check": "Live request or database operation failed", "status": "FAIL"}
            )
    if RESULTS:
        report = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "environment": "Supabase staging",
            "status": "PASS" if code == 0 else "FAIL",
            "checks": RESULTS,
            "limitations": [
                "Browser reload/session checks must also be run with Playwright.",
                "Fixture packs and staging users are intentionally retained for inspection.",
            ],
        }
        out = Path("docs/evidence/supabase-staging-report.json")
        out.parent.mkdir(exist_ok=True, parents=True)
        out.write_text(json.dumps(report, indent=2) + "\n")
        print(
            f"Redacted staging report written; {sum(c['status'] == 'PASS' for c in RESULTS)} checks passed."
        )
    sys.exit(code)
