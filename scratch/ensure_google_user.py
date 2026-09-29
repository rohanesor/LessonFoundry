import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
conn = psycopg.connect(os.environ['LF_TEST_ADMIN_DATABASE_URL'])
cur = conn.cursor()

cur.execute("""
INSERT INTO public.users (id, name, email, role, avatar_url)
VALUES ('cfcf7a26-768e-47f3-97a8-5889da9eff01', 'Rohan', 'rohanjml07@gmail.com', 'teacher', NULL)
ON CONFLICT (id) DO UPDATE SET role = 'teacher';
""")
conn.commit()
print("User inserted/updated in public.users successfully!")
