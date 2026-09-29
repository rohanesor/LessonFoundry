import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(".env")
url = os.environ["LF_TEST_ADMIN_DATABASE_URL"].replace("postgresql://", "postgresql+psycopg://")
engine = create_engine(url)
with engine.connect() as conn:
    print("USERS:")
    for r in conn.execute(text("SELECT id, name, email, role FROM users LIMIT 10")).fetchall():
        print(r)
    print("\nUNITS:")
    for r in conn.execute(text("SELECT id, owner_id, title FROM units LIMIT 5")).fetchall():
        print(r)
