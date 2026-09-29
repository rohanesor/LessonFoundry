import os
from dotenv import load_dotenv
import psycopg

load_dotenv()
conn = psycopg.connect(os.environ["LF_TEST_ADMIN_DATABASE_URL"])
cur = conn.execute("SELECT tablename FROM pg_policies WHERE schemaname='public' AND policyname LIKE '%_api_owner'")
tables = [r[0] for r in cur]
print("Count:", len(tables))
print("Tables:", tables)
