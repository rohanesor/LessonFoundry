import os
from dotenv import load_dotenv
import httpx
from sqlalchemy import create_engine, text

load_dotenv(".env")
url = os.environ["SUPABASE_URL"].rstrip("/")
secret = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
headers = {
    "apikey": secret,
    "Authorization": f"Bearer {secret}",
}
with httpx.Client(timeout=30) as client:
    r = client.get(f"{url}/auth/v1/admin/users", headers=headers)
    users = r.json().get("users", [])
    for u in users:
        print(f"Auth user: {u.get('email')} -> {u.get('id')}")

db_url = os.environ["LF_TEST_ADMIN_DATABASE_URL"].replace("postgresql://", "postgresql+psycopg://")
engine = create_engine(db_url)
with engine.connect() as conn:
    print("Database users:")
    for row in conn.execute(text("SELECT id, email, role FROM users")).fetchall():
        print(row)
