import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(".env")
url = os.environ["LF_TEST_ADMIN_DATABASE_URL"].replace("postgresql://", "postgresql+psycopg://")
engine = create_engine(url)
with engine.connect() as conn:
    print("MATCHING PACKS:")
    rows = conn.execute(text("SELECT id, title, revision, source_revision, owner_id FROM units WHERE title ILIKE '%Newton%'")).fetchall()
    for r in rows:
        print(r)
        # Objectives
        objs = conn.execute(text(f"SELECT id, position, status, description FROM objectives WHERE unit_id = '{r[0]}' ORDER BY position")).fetchall()
        print("  Objectives:", objs)
        # Jobs
        jobs = conn.execute(text(f"SELECT id, kind, state, message, created_at FROM jobs WHERE unit_id = '{r[0]}' ORDER BY created_at DESC LIMIT 3")).fetchall()
        print("  Jobs:", jobs)
