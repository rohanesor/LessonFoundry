import os
from pathlib import Path
from urllib.parse import quote
import httpx
from app.security import identity


class ObjectStore:
    """Normal I/O uses the teacher's JWT, not a service-role bypass."""

    def __init__(self, bucket: str | None = None):
        self.remote = os.getenv("AUTH_MODE") == "supabase"
        self.url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.bucket = bucket or os.getenv("SUPABASE_SOURCE_BUCKET", "sources")

    def headers(self):
        actor = identity.get()
        if not actor:
            raise ValueError("Verified teacher identity required for private storage")
        return {
            "Authorization": f"Bearer {actor.access_token}",
            "apikey": os.environ["SUPABASE_ANON_KEY"],
        }

    def object_url(self, key):
        return f"{self.url}/storage/v1/object/{quote(self.bucket, safe='')}/{quote(key, safe='/')}"

    def local_path(self, key):
        base = Path(os.getenv("LOCAL_STORAGE_PATH", ".local-files")).resolve()
        p = (base / key).resolve()
        if not p.is_relative_to(base):
            raise ValueError("Invalid object path")
        return p

    def put_server(self, key, data, content_type="application/octet-stream"):
        if not self.remote:
            return self.put(key, data, content_type)
        key_value = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not key_value: raise ValueError("Server storage credentials are not configured")
        r = httpx.post(self.object_url(key), headers={"Authorization": f"Bearer {key_value}", "apikey": key_value, "Content-Type": content_type, "x-upsert": "true"}, content=data, timeout=60)
        if not r.is_success: raise ValueError("Private server storage rejected upload")

    def put(self, key, data, content_type="application/octet-stream"):
        if self.remote:
            r = httpx.post(
                self.object_url(key),
                headers={
                    **self.headers(),
                    "Content-Type": content_type,
                    "x-upsert": "false",
                },
                content=data,
                timeout=30,
            )
            if not r.is_success:
                raise ValueError(
                    f"Private storage rejected upload (HTTP {r.status_code})"
                )
        else:
            p = self.local_path(key)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)

    def delete(self, key):
        if self.remote:
            r = httpx.request(
                "DELETE",
                f"{self.url}/storage/v1/object/{quote(self.bucket, safe='')}",
                headers=self.headers(),
                json={"prefixes": [key]},
                timeout=20,
            )
            if not r.is_success:
                raise ValueError("Storage cleanup failed")
        else:
            self.local_path(key).unlink(missing_ok=True)

    def sign(self, key, expires=60):
        if not self.remote:
            raise ValueError("Signed URLs require Supabase Storage")
        r = httpx.post(
            f"{self.url}/storage/v1/object/sign/{quote(self.bucket, safe='')}/{quote(key, safe='/')}",
            headers=self.headers(),
            json={"expiresIn": expires},
            timeout=20,
        )
        if not r.is_success:
            raise ValueError("Private storage denied temporary download")
        path = r.json()["signedURL"]
        if not path.startswith("/object/sign/"):
            raise ValueError("Unexpected storage signing response")
        return {"url": f"{self.url}/storage/v1{path}", "expires_in": expires}

    def create_server_download_url(self, key, expires=60):
        """Server-side authorized media signing after API authorization.
        The service key never leaves the backend process.
        """
        if not self.remote:
            return {"url": f"/local-files/{key}", "expires_in": expires}
        key_value = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not key_value:
            raise ValueError("Server media signing is not configured")
        r = httpx.post(
            f"{self.url}/storage/v1/object/sign/{quote(self.bucket, safe='')}/{quote(key, safe='/')}",
            headers={"Authorization": f"Bearer {key_value}", "apikey": key_value},
            json={"expiresIn": expires}, timeout=20,
        )
        if not r.is_success: raise ValueError("Private media signing failed")
        path = r.json()["signedURL"]
        return {"url": f"{self.url}/storage/v1{path}", "expires_in": expires}

    def create_download_url(self, key, expires=300):
        """Generate a download URL. Delegates to sign() for Supabase, S3 for S3."""
        if self.remote:
            return self.sign(key, expires)
        # Local mode: return a local path reference (not a real URL).
        return {"url": f"/local-files/{key}", "expires_in": expires}


class S3ObjectStore:
    """AWS S3 private bucket storage. Server-side only."""

    def __init__(self, bucket: str | None = None):
        import boto3
        from botocore.client import Config
        self.bucket = os.environ.get("AWS_S3_BUCKET") or (bucket or "sources")
        self.prefix = bucket if (bucket and bucket != self.bucket) else ""
        self.region = os.getenv("AWS_REGION", "ap-south-1")
        endpoint = f"https://s3.{self.region}.amazonaws.com"
        config = Config(signature_version="s3v4", s3={"addressing_style": "virtual"})
        self.client = boto3.client("s3", region_name=self.region, endpoint_url=endpoint, config=config)

    def _full_key(self, key: str) -> str:
        prefix = getattr(self, "prefix", "")
        if prefix and not key.startswith(f"{prefix}/"):
            return f"{prefix}/{key}"
        return key

    def put(self, key, data, content_type="application/octet-stream"):
        self.client.put_object(
            Bucket=self.bucket, Key=self._full_key(key), Body=data, ContentType=content_type,
            ServerSideEncryption="AES256",
        )

    def put_server(self, key, data, content_type="application/octet-stream"):
        return self.put(key, data, content_type)

    def delete(self, key):
        self.client.delete_object(Bucket=self.bucket, Key=self._full_key(key))

    def create_download_url(self, key, expires=300):
        url = self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": self._full_key(key)},
            ExpiresIn=expires,
        )
        return {"url": url, "expires_in": expires}

    def sign(self, key, expires=300):
        return self.create_download_url(key, expires)

    def create_server_download_url(self, key, expires=60):
        return self.create_download_url(key, expires)


def get_store(bucket: str | None = None):
    """Factory: return the appropriate private store and bucket."""
    provider = os.getenv("STORAGE_PROVIDER", "")
    if provider == "s3":
        return S3ObjectStore(bucket)
    return ObjectStore(bucket)
