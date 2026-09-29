import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(".env")
url = os.environ["LF_TEST_ADMIN_DATABASE_URL"].replace("postgresql://", "postgresql+psycopg://")
engine = create_engine(url)
with engine.connect() as conn:
    print("SOURCES:")
    for r in conn.execute(text("SELECT id, name, current_version FROM source_documents WHERE unit_id = '6d2a4e81-3cb1-4714-a98f-0ba0652f0f45'")).fetchall():
        print(r)
