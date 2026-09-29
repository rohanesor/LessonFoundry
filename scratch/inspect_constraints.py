import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
conn = psycopg.connect(os.environ['LF_TEST_ADMIN_DATABASE_URL'])
cur = conn.cursor()

cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';")
print("columns:")
for col in cur.fetchall():
    print(col)

cur.execute("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.users'::regclass;")
print("\nconstraints:")
for c in cur.fetchall():
    print(c[0], "-->", c[1])
