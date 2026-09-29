import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
conn = psycopg.connect(os.environ['LF_TEST_ADMIN_DATABASE_URL'])
cur = conn.cursor()

# Check recent users in auth.users
cur.execute("SELECT id, email, raw_user_meta_data, raw_app_meta_data, created_at, last_sign_in_at FROM auth.users ORDER BY created_at DESC;")
rows = cur.fetchall()
print("Total auth.users:", len(rows))
for r in rows:
    print(r)

# Check identities
cur.execute("SELECT id, user_id, identity_data, provider, last_sign_in_at, created_at FROM auth.identities;")
identities = cur.fetchall()
print("\nTotal auth.identities:", len(identities))
for i in identities:
    print(i)
