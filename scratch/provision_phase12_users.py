import os
from dotenv import load_dotenv
import httpx

load_dotenv(".env")
url = os.environ["SUPABASE_URL"].rstrip("/")
secret = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

users = [
    {
        "email": "staging-teacher@lessonfoundry.internal",
        "password": "StagingTeacherPass123!",
        "role": "teacher",
    },
    {
        "email": "staging-student@lessonfoundry.internal",
        "password": "StagingStudentPass123!",
        "role": "student",
    },
]

headers = {
    "apikey": secret,
    "Authorization": f"Bearer {secret}",
    "Content-Type": "application/json",
}

with httpx.Client(timeout=30) as client:
    # List existing users to avoid duplicates
    r = client.get(f"{url}/auth/v1/admin/users", headers=headers)
    existing = {u["email"]: u for u in r.json().get("users", [])}
    
    for u in users:
        email = u["email"]
        if email in existing:
            uid = existing[email]["id"]
            print(f"User {email} already exists (id: {uid}), updating password & metadata...")
            res = client.put(
                f"{url}/auth/v1/admin/users/{uid}",
                headers=headers,
                json={
                    "password": u["password"],
                    "email_confirm": True,
                    "app_metadata": {"role": u["role"]},
                    "user_metadata": {"name": f"Staging {u['role'].title()}"},
                }
            )
            print("Update status:", res.status_code)
        else:
            print(f"Creating user {email} with role {u['role']}...")
            res = client.post(
                f"{url}/auth/v1/admin/users",
                headers=headers,
                json={
                    "email": email,
                    "password": u["password"],
                    "email_confirm": True,
                    "app_metadata": {"role": u["role"]},
                    "user_metadata": {"name": f"Staging {u['role'].title()}"},
                }
            )
            print("Create status:", res.status_code)
print("Provisioning complete!")
