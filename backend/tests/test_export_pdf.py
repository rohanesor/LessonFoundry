from io import BytesIO

import pytest
from pypdf import PdfReader

from app.services.export import ReportLabRenderer, render_pack_pdf
from app.services.storage import S3ObjectStore


def approved_pack():
    evidence_id = "evidence-1"
    return {
        "id": "unit-1", "title": "Plant Energy", "subject": "Biology",
        "level": "Class 10", "exam": "Science", "revision": 3, "source_revision": 2,
        "resources": [{"title": "Leaf investigation", "url": "https://example.invalid/leaf"}],
        "assets": [
            {"slot": "explanation", "state": "APPROVED", "source_revision": 2, "payload": {"title": "Photosynthesis", "body": "Plants use light energy.", "options": [], "answer": None, "solution": "", "evidence_ids": [evidence_id]}},
            {"slot": "quiz1", "state": "APPROVED", "source_revision": 2, "payload": {"title": "Quiz 1", "body": "What absorbs light?", "options": ["Chlorophyll", "Water", "Oxygen", "Starch"], "answer": 0, "solution": "Chlorophyll absorbs light.", "evidence_ids": [evidence_id]}},
            {"slot": "exam_focus", "state": "APPROVED", "source_revision": 2, "payload": {"title": "Must know", "body": "Carbon dioxide enters through stomata.", "options": [], "answer": None, "solution": "", "evidence_ids": [evidence_id], "flowchart": {"nodes": [{"id": "a", "label": "Light"}, {"id": "b", "label": "Glucose"}], "edges": [{"source": "a", "target": "b", "relationship": "helps make"}]}}},
            {"slot": "video_script", "state": "APPROVED", "source_revision": 2, "payload": {"title": "Teacher Script", "body": "Scene 1: Explain the process.", "options": [], "answer": None, "solution": "", "evidence_ids": [evidence_id]}},
        ],
    }


def test_renderer_creates_readable_pdf_with_approved_content():
    pdf = ReportLabRenderer().render(approved_pack())
    assert pdf.startswith(b"%PDF-")
    text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(pdf)).pages)
    assert "Plant Energy" in text
    assert "Photosynthesis" in text
    assert "Answer Key" in text
    assert "Teacher Script" in text


def test_renderer_rejects_unapproved_or_stale_content():
    pack = approved_pack()
    pack["assets"][0]["state"] = "DRAFT"
    with pytest.raises(ValueError, match="Only approved"):
        ReportLabRenderer().render(pack)
    pack["assets"][0]["state"] = "APPROVED"
    pack["assets"][0]["source_revision"] = 1
    with pytest.raises(ValueError, match="stale"):
        ReportLabRenderer().render(pack)


def test_render_uploads_pdf_with_private_pdf_metadata(monkeypatch):
    calls = []

    class Store:
        def put(self, key, data, content_type):
            calls.append((key, data, content_type))

    monkeypatch.setattr("app.services.export.get_store", lambda: Store())
    result = render_pack_pdf(approved_pack(), "export-1")
    assert result["storage_key"] == "exports/unit-1/export-1.pdf"
    assert result["mime_type"] == "application/pdf"
    assert result["file_size"] == len(calls[0][1])
    assert calls[0][0] == result["storage_key"]
    assert calls[0][2] == "application/pdf"
    assert calls[0][1].startswith(b"%PDF-")


def test_s3_store_sets_pdf_content_type_without_public_acl():
    calls = []

    class Client:
        def put_object(self, **kwargs):
            calls.append(kwargs)

    store = S3ObjectStore.__new__(S3ObjectStore)
    store.bucket = "private-test-bucket"
    store.client = Client()
    store.put("exports/unit/export.pdf", b"%PDF-test", content_type="application/pdf")
    assert calls == [{
        "Bucket": "private-test-bucket", "Key": "exports/unit/export.pdf",
        "Body": b"%PDF-test", "ContentType": "application/pdf", "ServerSideEncryption": "AES256",
    }]
    assert "ACL" not in calls[0]


def test_s3_presigned_url_is_short_lived_and_uses_no_public_acl():
    calls = []

    class Client:
        def generate_presigned_url(self, operation, Params, ExpiresIn):
            calls.append((operation, Params, ExpiresIn))
            return "https://signed.example.invalid/download"

    store = S3ObjectStore.__new__(S3ObjectStore)
    store.bucket = "private-test-bucket"
    store.client = Client()
    result = store.create_download_url("exports/unit/export.pdf", expires=300)
    assert result == {"url": "https://signed.example.invalid/download", "expires_in": 300}
    assert calls == [("get_object", {"Bucket": "private-test-bucket", "Key": "exports/unit/export.pdf"}, 300)]
