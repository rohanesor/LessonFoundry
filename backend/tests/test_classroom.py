"""Classroom, membership, publication, and authenticated student tests."""

import os, tempfile

os.environ["DATABASE_URL"] = "sqlite:///" + tempfile.mktemp(suffix=".sqlite3")
os.environ["LLM_PROVIDER"] = "mock"
os.environ["AUTH_MODE"] = "local"
os.environ["LOCAL_TEACHER_TOKEN"] = "test-teacher"
os.environ["LOCAL_STUDENT_TOKEN"] = "test-student"

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine
from app.jobs.worker import tick

T = {"Authorization": "Bearer test-teacher"}
S = {"Authorization": "Bearer test-student"}


@pytest.fixture(autouse=True)
def clean():
    # SQLite FK constraints prevent naive drop_all; disable temporarily.
    with engine.connect() as conn:
        conn.execute(__import__('sqlalchemy').text('PRAGMA foreign_keys=OFF'))
        conn.commit()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with engine.connect() as conn:
        conn.execute(__import__('sqlalchemy').text('PRAGMA foreign_keys=ON'))
        conn.commit()
    yield


def _api():
    return TestClient(app, raise_server_exceptions=False)


def _create_classroom(c, name="Test Classroom"):
    r = c.post("/api/classrooms", json={"name": name}, headers=T)
    assert r.status_code == 201, r.text
    return r.json()


def _demo_pack(c, classroom_id):
    r = c.post(
        "/api/packs",
        json={
            "title": "BST Basics",
            "objectives": ["Understand BST insertion", "Perform BST search"],
            "classroom_id": classroom_id,
        },
        headers=T,
    )
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    c.post(
        f"/api/packs/{pid}/sources/text",
        json={
            "name": "notes.txt",
            "text": "A binary search tree maintains sorted order. "
            "Insertion compares the new key with each node and recurses left or right. "
            "Search follows the same comparison path until the key is found or a leaf is reached.",
        },
        headers=T,
    )
    c.post(f"/api/packs/{pid}/gap-check", headers=T)
    tick()
    c.post(f"/api/packs/{pid}/generate", headers=T)
    tick()
    return pid


def _approve_all(c, pid):
    pack = c.get(f"/api/packs/{pid}", headers=T).json()
    for a in pack["assets"]:
        c.post(
            f"/api/assets/{a['id']}/approve",
            json={"expected_version": a["version"], "note": "Reviewed for test."},
            headers=T,
        )


# ─── Classroom CRUD ──────────────────────────────────────────────────────────

def test_create_classroom():
    c = _api()
    data = _create_classroom(c, "Data Structures")
    assert data["join_code"].startswith("LF-")
    assert len(data["join_code"]) == 8


def test_list_classrooms():
    c = _api()
    _create_classroom(c, "Algorithms")
    r = c.get("/api/classrooms", headers=T)
    assert r.status_code == 200
    assert any(cr["name"] == "Algorithms" for cr in r.json())


def test_update_classroom():
    c = _api()
    data = _create_classroom(c)
    r = c.patch(f"/api/classrooms/{data['id']}", json={"name": "Updated"}, headers=T)
    assert r.status_code == 200


def test_archive_classroom():
    c = _api()
    data = _create_classroom(c)
    r = c.delete(f"/api/classrooms/{data['id']}", headers=T)
    assert r.status_code == 200


def test_regenerate_code():
    c = _api()
    data = _create_classroom(c)
    old_code = data["join_code"]
    r = c.post(f"/api/classrooms/{data['id']}/regenerate-code", headers=T)
    assert r.json()["join_code"] != old_code


# ─── Membership ──────────────────────────────────────────────────────────────

def test_student_join():
    c = _api()
    data = _create_classroom(c)
    r = c.post(f"/api/classrooms/{data['id']}/join", json={"code": data["join_code"]}, headers=S)
    assert r.status_code == 200
    assert r.json()["joined"] is True


def test_student_invalid_code():
    c = _api()
    data = _create_classroom(c)
    r = c.post(f"/api/classrooms/{data['id']}/join", json={"code": "LF-XXXXX"}, headers=S)
    assert r.status_code == 400


def test_student_duplicate_join():
    c = _api()
    data = _create_classroom(c)
    c.post(f"/api/classrooms/{data['id']}/join", json={"code": data["join_code"]}, headers=S)
    r = c.post(f"/api/classrooms/{data['id']}/join", json={"code": data["join_code"]}, headers=S)
    assert r.status_code == 409


def test_student_join_by_code_alone():
    c = _api()
    data = _create_classroom(c)
    r = c.post("/api/join", json={"code": data["join_code"]}, headers=S)
    assert r.status_code == 200
    assert r.json()["joined"] is True
    assert r.json()["classroom_id"] == data["id"]

    # duplicate
    r_dup = c.post("/api/join", json={"code": data["join_code"]}, headers=S)
    assert r_dup.status_code == 409

    # invalid code
    r_inv = c.post("/api/join", json={"code": "LF-BADCD"}, headers=S)
    assert r_inv.status_code == 400


def test_list_and_remove_members():
    c = _api()
    data = _create_classroom(c)
    c.post(f"/api/classrooms/{data['id']}/join", json={"code": data["join_code"]}, headers=S)
    r = c.get(f"/api/classrooms/{data['id']}/members", headers=T)
    assert len(r.json()) == 1
    c.delete(f"/api/classrooms/{data['id']}/members/local-student", headers=T)


# ─── Publication ─────────────────────────────────────────────────────────────

def test_publish_requires_classroom():
    c = _api()
    r = c.post("/api/packs", json={"title": "No Class", "objectives": ["A", "B"]}, headers=T)
    pid = r.json()["id"]
    r = c.post(f"/api/packs/{pid}/publish", headers=T)
    assert r.status_code == 409


def test_publish_requires_approved():
    c = _api()
    data = _create_classroom(c)
    r = c.post("/api/packs", json={"title": "Draft", "objectives": ["A", "B"], "classroom_id": data["id"]}, headers=T)
    pid = r.json()["id"]
    r = c.post(f"/api/packs/{pid}/publish", headers=T)
    assert r.status_code == 409


def test_approve_publish_unpublish():
    c = _api()
    data = _create_classroom(c)
    pid = _demo_pack(c, data["id"])
    _approve_all(c, pid)
    r = c.post(f"/api/packs/{pid}/publish", headers=T)
    assert r.status_code == 200
    assert r.json()["published_at"] is not None
    r = c.post(f"/api/packs/{pid}/unpublish", headers=T)
    assert r.status_code == 200


# ─── Student access ──────────────────────────────────────────────────────────

def test_student_classrooms():
    c = _api()
    data = _create_classroom(c, "Visible")
    c.post(f"/api/classrooms/{data['id']}/join", json={"code": data["join_code"]}, headers=S)
    r = c.get("/api/student/classrooms", headers=S)
    assert r.status_code == 200
    assert any(cr["name"] == "Visible" for cr in r.json())


def test_student_sees_published_only():
    c = _api()
    data = _create_classroom(c)
    pid = _demo_pack(c, data["id"])
    c.post(f"/api/classrooms/{data['id']}/join", json={"code": data["join_code"]}, headers=S)
    # Before publish
    r = c.get(f"/api/student/classrooms/{data['id']}/packs", headers=S)
    assert len(r.json()) == 0
    # After publish
    _approve_all(c, pid)
    c.post(f"/api/packs/{pid}/publish", headers=T)
    r = c.get(f"/api/student/classrooms/{data['id']}/packs", headers=S)
    assert len(r.json()) == 1
    r = c.get(f"/api/student/packs/{pid}", headers=S)
    assert r.status_code == 200
    assert len(r.json()["assets"]) > 0


def test_student_cannot_access_draft():
    c = _api()
    data = _create_classroom(c)
    pid = _demo_pack(c, data["id"])
    c.post(f"/api/classrooms/{data['id']}/join", json={"code": data["join_code"]}, headers=S)
    r = c.get(f"/api/student/packs/{pid}", headers=S)
    assert r.status_code == 404


def test_student_cannot_access_other_classroom():
    c = _api()
    d1 = _create_classroom(c, "Alpha")
    d2 = _create_classroom(c, "Beta")
    c.post(f"/api/classrooms/{d1['id']}/join", json={"code": d1["join_code"]}, headers=S)
    r = c.get(f"/api/student/classrooms/{d2['id']}", headers=S)
    assert r.status_code == 403


# ─── Cross-role checks ──────────────────────────────────────────────────────

def test_student_cannot_create_classroom():
    c = _api()
    r = c.post("/api/classrooms", json={"name": "Hack"}, headers=S)
    assert r.status_code == 403


def test_teacher_cannot_join():
    c = _api()
    data = _create_classroom(c)
    r = c.post(f"/api/classrooms/{data['id']}/join", json={"code": data["join_code"]}, headers=T)
    assert r.status_code == 403


# ─── Health ──────────────────────────────────────────────────────────────────

def test_readiness():
    c = _api()
    r = c.get("/api/ready")
    assert r.status_code == 200
