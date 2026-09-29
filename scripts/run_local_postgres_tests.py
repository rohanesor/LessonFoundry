"""Create a disposable loopback-only PostgreSQL cluster and run real RLS tests.
Requires locally installed PostgreSQL binaries. Uses Auth/Storage SQL stand-ins,
not a managed Supabase project. Does not touch any configured DATABASE_URL.
"""

import getpass, os, shutil, socket, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    candidates = sorted(Path("/usr/lib/postgresql").glob("*/bin/initdb"), reverse=True)
    initdb = shutil.which("initdb") or (str(candidates[0]) if candidates else None)
    if not initdb:
        print("BLOCKED: local PostgreSQL initdb/postgres/pg_ctl binaries are required")
        return 2
    bindir = Path(initdb).parent
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix="lf-rls-") as directory:
        base = Path(directory)
        data = base / "data"
        sockdir = base / "socket"
        sockdir.mkdir()

        def command(args):
            r = subprocess.run(
                [str(x) for x in args], stdout=subprocess.PIPE, stderr=subprocess.PIPE
            )
            if r.returncode:
                raise RuntimeError(
                    "Local PostgreSQL setup failed (no credentials or SQL values logged)"
                )

        command([initdb, "-D", data, "--auth=trust", "--no-instructions"])
        command(
            [
                bindir / "pg_ctl",
                "-D",
                data,
                "-l",
                base / "server.log",
                "-o",
                f"-p {port} -h 127.0.0.1 -k {sockdir}",
                "start",
            ]
        )
        try:
            import psycopg

            user = getpass.getuser()
            dsn = f"postgresql://{user}@127.0.0.1:{port}/postgres"
            with psycopg.connect(dsn, autocommit=True) as c:
                c.execute("CREATE DATABASE lessonfoundry_security_test")
            admin = f"postgresql://{user}@127.0.0.1:{port}/lessonfoundry_security_test"
            files = [
                "backend/integration/000_auth_shim.sql",
                "backend/migrations/001_initial.sql",
                "backend/migrations/002_staging_security.sql",
                "backend/integration/bootstrap_local.sql",
                "backend/migrations/003_private_storage.sql",
            ]
            with psycopg.connect(admin, autocommit=True) as c:
                for filename in files:
                    c.execute((ROOT / filename).read_text())
            env = {
                **os.environ,
                "APP_ENV": "staging",
                "AUTH_MODE": "supabase",
                "SUPABASE_URL": "https://local-test.invalid",
                "SUPABASE_ANON_KEY": "local-test-only",
                "LLM_PROVIDER": "mock",
                "DATABASE_URL": f"postgresql+psycopg://lf_test_api_login@127.0.0.1:{port}/lessonfoundry_security_test",
                "WORKER_DATABASE_URL": f"postgresql+psycopg://lf_test_worker_login@127.0.0.1:{port}/lessonfoundry_security_test",
                "LF_TEST_ADMIN_DATABASE_URL": admin,
                "PYTHONPATH": str(ROOT / "backend"),
            }
            return subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "pytest",
                    "backend/integration/test_postgres_security.py",
                    "-q",
                ],
                cwd=ROOT,
                env=env,
            ).returncode
        finally:
            command([bindir / "pg_ctl", "-D", data, "stop", "-m", "fast"])


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        print(
            "Local PostgreSQL verification failed during setup; no Supabase checks were executed."
        )
        sys.exit(1)
