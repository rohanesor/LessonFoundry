import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
conn = psycopg.connect(os.environ['LF_TEST_ADMIN_DATABASE_URL'])
cur = conn.cursor()

cur.execute("SELECT * FROM public.users WHERE id='cfcf7a26-768e-47f3-97a8-5889da9eff01';")
print("public.users row:", cur.fetchall())

cur.execute("SELECT * FROM public.users;")
print("all public.users:")
for r in cur.fetchall():
    print(r)
