import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
conn = psycopg.connect(os.environ['LF_TEST_ADMIN_DATABASE_URL'])
cur = conn.cursor()

cur.execute("SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.users'::regclass;")
for r in cur.fetchall():
    print("TRIGGER:", r[0], "-->", r[1])
