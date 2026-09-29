"""Export worker and authorized teacher/student download flow, using local storage."""
from fastapi.testclient import TestClient
from sqlalchemy import text, select

from app.database import Base, engine, transaction
from app.jobs.worker import tick
from app.main import app
from app.models.entities import Export

TEACHER = {"Authorization": "Bearer test-teacher"}
STUDENT = {"Authorization": "Bearer test-student"}


def reset_db():
    with engine.begin() as connection:
        if engine.dialect.name == "sqlite":
            connection.execute(text("PRAGMA foreign_keys=OFF"))
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        if engine.dialect.name == "sqlite":
            connection.execute(text("PRAGMA foreign_keys=ON"))


def test_approved_publish_creates_pdf_export_and_authorized_download(monkeypatch):
    monkeypatch.setenv("STORAGE_PROVIDER", "local")
    reset_db()
    with TestClient(app, raise_server_exceptions=False) as client:
        classroom = client.post("/api/classrooms", headers=TEACHER, json={"name": "Export class"}).json()
        pack = client.post("/api/packs", headers=TEACHER, json={
            "title": "Plant energy", "classroom_id": classroom["id"],
            "objectives": ["Explain photosynthesis", "Describe light energy"],
        }).json()
        pack_id = pack["id"]
        source = client.post(f"/api/packs/{pack_id}/sources/text", headers=TEACHER, json={
            "name": "source.txt", "text": "Photosynthesis uses light energy in chloroplasts. Chlorophyll absorbs light. Plants combine water and carbon dioxide to make glucose and release oxygen.",
        })
        assert source.status_code == 200
        assert client.post(f"/api/packs/{pack_id}/gap-check", headers=TEACHER).status_code == 202
        assert tick()
        assert client.post(f"/api/packs/{pack_id}/generate", headers=TEACHER).status_code == 202
        assert tick()
        detail = client.get(f"/api/packs/{pack_id}", headers=TEACHER).json()
        for asset in detail["assets"]:
            approved = client.post(f"/api/assets/{asset['id']}/approve", headers=TEACHER, json={"expected_version": asset["version"], "note": "Reviewed approved export content."})
            assert approved.status_code == 200, approved.text
        assert client.post(f"/api/packs/{pack_id}/publish", headers=TEACHER).status_code == 200
        assert tick()

        with transaction() as session:
            export = session.scalar(select(Export).where(Export.unit_id == pack_id))
            assert export.status == "completed"
            assert export.storage_key.endswith(".pdf")
            assert export.mime_type == "application/pdf"
            assert export.file_size and export.file_size > 100
            assert export.requested_by == "local-teacher"

        assert client.post(f"/api/classrooms/{classroom['id']}/join", headers=STUDENT, json={"code": classroom["join_code"]}).status_code == 200
        assert client.post(f"/api/packs/{pack_id}/download", headers=TEACHER).status_code == 200
        student_download = client.post(f"/api/student/packs/{pack_id}/download", headers=STUDENT)
        assert student_download.status_code == 200
        assert student_download.json()["expires_in"] == 300


def test_export_failure_is_recorded_without_renderer_exception_detail(monkeypatch):
    monkeypatch.setenv("STORAGE_PROVIDER", "local")
    reset_db()
    # Worker failure behavior is covered by an isolated queued export record;
    # no renderer or storage network operation is performed.
    from app.models.entities import User, Unit, Export, Job
    with transaction() as session:
        session.add(User(id="local-teacher", name="Teacher", role="teacher"))
        session.flush()
        unit = Unit(owner_id="local-teacher", title="Approved", classroom_id=None)
        session.add(unit); session.flush()
        export = Export(unit_id=unit.id, revision=unit.revision, requested_by="local-teacher", status="queued")
        session.add(export)
        job = Job(unit_id=unit.id, kind="export", expected_revision=unit.revision)
        session.add(job); session.flush()
    monkeypatch.setattr("app.jobs.worker.render_pack_pdf", lambda *args: (_ for _ in ()).throw(RuntimeError("do not disclose storage credentials")))
    assert tick()
    with transaction() as session:
        export = session.scalar(select(Export).where(Export.unit_id == unit.id))
        assert export.status == "failed"
        assert export.error == "PDF export failed; inspect protected worker logs."
        assert "credential" not in export.error
