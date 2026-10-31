"""API-level tests for Adaptive Learning endpoints.

These tests use FastAPI's TestClient for faster execution without
requiring the full frontend stack.

Note: This file relies on conftest.py to set up the test environment.
"""

import os
import pytest
from fastapi.testclient import TestClient

# Import after conftest.py sets up environment
from app.main import app
from app.database import Base, engine, Session
from app.models.entities import Unit, ClassroomMember, now
from sqlalchemy import select


def create_classroom_linked_problem(client, teacher_headers, student_headers, topic):
    """Create an enrolled student + published classroom unit + linked challenge."""
    classroom_response = client.post(
        "/api/classrooms", headers=teacher_headers,
        json={"name": f"{topic} classroom", "description": "API test"},
    )
    assert classroom_response.status_code == 201
    classroom = classroom_response.json()
    joined = client.post(
        "/api/join", headers=student_headers, json={"code": classroom["join_code"]}
    )
    assert joined.status_code == 200
    pack_response = client.post(
        "/api/packs", headers=teacher_headers,
        json={
            "title": f"{topic} pack", "classroom_id": classroom["id"],
            "objectives": ["Understand the concept", "Apply the concept"],
        },
    )
    assert pack_response.status_code == 201
    unit_id = pack_response.json()["id"]
    # The route requires the unit to be published to student-facing surfaces;
    # this fixture isolates the challenge authorization contract from pack review.
    with Session.begin() as session:
        unit = session.get(Unit, unit_id)
        unit.published_at = now()
    problem_response = client.post(
        "/api/teacher/problems", headers=teacher_headers,
        json={"topic": topic, "difficulty": "easy", "unit_id": unit_id},
    )
    assert problem_response.status_code == 201, problem_response.text
    return problem_response.json()["id"], classroom["id"]


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Create tables before tests."""
    Base.metadata.create_all(engine, checkfirst=True)
    yield


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def teacher_headers():
    """Authentication headers for teacher (from conftest.py)."""
    token = os.getenv("LOCAL_TEACHER_TOKEN", "test-teacher")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers(teacher_headers):
    """Alias for teacher_headers for backward compatibility."""
    return teacher_headers


@pytest.fixture
def student_headers():
    """Authentication headers for student (from conftest.py)."""
    token = os.getenv("LOCAL_STUDENT_TOKEN", "test-student")
    return {"Authorization": f"Bearer {token}"}


class TestStudentPerformanceAPI:
    """Tests for student performance endpoints."""

    def test_get_performance_returns_200(self, client, student_headers):
        """GET /api/student/performance should return 200."""
        response = client.get("/api/student/performance", headers=student_headers)
        assert response.status_code == 200

    def test_performance_response_structure(self, client, student_headers):
        """Performance response should have correct structure."""
        response = client.get("/api/student/performance", headers=student_headers)
        data = response.json()

        assert "total_attempts" in data
        assert "overall_accuracy" in data
        assert "weak_topics" in data
        assert "strong_topics" in data

    def test_get_attempts_returns_200(self, client, student_headers):
        """GET /api/student/attempts should return 200."""
        response = client.get("/api/student/attempts", headers=student_headers)
        assert response.status_code == 200

    def test_attempts_response_structure(self, client, student_headers):
        """Attempts response should have correct structure."""
        response = client.get("/api/student/attempts", headers=student_headers)
        data = response.json()

        assert "attempts" in data
        assert isinstance(data["attempts"], list)


class TestLearningPlansAPI:
    """Tests for learning plan endpoints."""

    def test_list_plans_returns_200(self, client, student_headers):
        """GET /api/student/learning-plans should return 200."""
        response = client.get("/api/student/learning-plans", headers=student_headers)
        assert response.status_code == 200

    def test_get_nonexistent_plan_returns_404(self, client, student_headers):
        """GET /api/student/learning-plans/{id} should return 404 for invalid ID."""
        response = client.get(
            "/api/student/learning-plans/nonexistent-id",
            headers=student_headers
        )
        assert response.status_code == 404

    def test_delete_nonexistent_plan_returns_404(self, client, student_headers):
        """DELETE /api/student/learning-plans/{id} should return 404 for invalid ID."""
        response = client.delete(
            "/api/student/learning-plans/nonexistent-id",
            headers=student_headers
        )
        assert response.status_code == 404


class TestRemedialContentAPI:
    """Tests for remedial content endpoints."""

    def test_get_remedial_content_returns_200(self, client, student_headers):
        """GET /api/student/remedial-content should return 200."""
        response = client.get("/api/student/remedial-content", headers=student_headers)
        assert response.status_code == 200

    def test_remedial_content_structure(self, client, student_headers):
        """Remedial content response should have correct structure."""
        response = client.get("/api/student/remedial-content", headers=student_headers)
        data = response.json()

        assert "results" in data
        assert isinstance(data["results"], list)


class TestCodingProblemsAPI:
    """Tests for coding problem endpoints."""

    @pytest.fixture
    def problem_id(self, client, teacher_headers, student_headers):
        """Create a problem in a classroom the test student is enrolled in."""
        problem_id, _ = create_classroom_linked_problem(
            client, teacher_headers, student_headers, "test-loops"
        )
        return problem_id

    def test_create_problem_returns_201(self, client, teacher_headers):
        """POST /api/teacher/problems should return 201."""
        response = client.post(
            "/api/teacher/problems",
            headers=teacher_headers,
            json={"topic": "functions", "difficulty": "medium"}
        )
        assert response.status_code == 201

    def test_create_problem_response_structure(self, client, teacher_headers):
        """Created problem should have correct structure."""
        response = client.post(
            "/api/teacher/problems",
            headers=teacher_headers,
            json={"topic": "lists", "difficulty": "hard"}
        )
        data = response.json()

        assert "id" in data
        assert "topic" in data
        assert "difficulty" in data
        assert "title" in data

    def test_list_problems_returns_200(self, client, teacher_headers):
        """GET /api/teacher/problems should return 200."""
        response = client.get("/api/teacher/problems", headers=teacher_headers)
        assert response.status_code == 200

    def test_get_problem_returns_200(self, client, student_headers, problem_id):
        """GET /api/student/problems/{id} should return 200."""
        response = client.get(
            f"/api/student/problems/{problem_id}",
            headers=student_headers
        )
        assert response.status_code == 200

    def test_get_problem_hides_solution(self, client, student_headers, problem_id):
        """Problem response should NOT include solution or test_cases."""
        response = client.get(
            f"/api/student/problems/{problem_id}",
            headers=student_headers
        )
        data = response.json()

        # These should NOT be exposed to students
        assert "solution" not in data
        assert "test_cases" not in data

    def test_get_nonexistent_problem_returns_404(self, client, student_headers):
        """GET /api/student/problems/{id} should return 404 for invalid ID."""
        response = client.get(
            "/api/student/problems/nonexistent-id",
            headers=student_headers
        )
        assert response.status_code == 404

    def test_unlinked_problem_is_not_exposed_to_students(self, client, teacher_headers, student_headers):
        created = client.post(
            "/api/teacher/problems", headers=teacher_headers,
            json={"topic": "private draft", "difficulty": "easy"},
        )
        assert created.status_code == 201
        response = client.get(
            f"/api/student/problems/{created.json()['id']}",
            headers=student_headers,
        )
        assert response.status_code == 404

    def test_challenges_are_hidden_from_non_enrolled_students(self, client, teacher_headers, student_headers):
        problem_id, classroom_id = create_classroom_linked_problem(
            client, teacher_headers, student_headers, "enrollment-check"
        )
        # Mark this local test user's membership inactive to exercise the
        # non-enrolled path (local auth intentionally maps one student token to
        # one fixed identity).
        with Session.begin() as session:
            member = session.scalar(select(ClassroomMember).where(
                ClassroomMember.classroom_id == classroom_id,
                ClassroomMember.user_id == "local-student",
            ))
            member.status = "inactive"
        assert client.get(
            f"/api/student/problems?classroom_id={classroom_id}", headers=student_headers
        ).status_code == 403
        assert client.get(
            f"/api/student/problems/{problem_id}", headers=student_headers
        ).status_code == 404
        assert client.post(
            f"/api/student/problems/{problem_id}/submit", headers=student_headers,
            json={"code": "pass", "language": "python"},
        ).status_code == 404


class TestCodeSubmissionAPI:
    """Tests for code submission endpoints."""

    @pytest.fixture
    def problem_id(self, client, teacher_headers, student_headers):
        """Create a problem in a published classroom unit for this student."""
        problem_id, _ = create_classroom_linked_problem(
            client, teacher_headers, student_headers, "submission-test"
        )
        return problem_id

    def test_submit_code_returns_200(self, client, student_headers, problem_id):
        """POST /api/student/problems/{id}/submit should return 200."""
        response = client.post(
            f"/api/student/problems/{problem_id}/submit",
            headers=student_headers,
            json={"code": "print('hello')", "language": "python"}
        )
        assert response.status_code == 200

    def test_submit_code_response_structure(self, client, student_headers, problem_id):
        """Submission response should have correct structure."""
        response = client.post(
            f"/api/student/problems/{problem_id}/submit",
            headers=student_headers,
            json={"code": "print(1 + 2)", "language": "python"}
        )
        data = response.json()

        assert "submission_id" in data
        assert "status" in data
        assert "feedback" in data
        assert "passed_count" in data
        assert "total_count" in data
        assert "test_results" in data

    def test_submit_empty_code_returns_422(self, client, student_headers, problem_id):
        """Empty code should be rejected with 422."""
        response = client.post(
            f"/api/student/problems/{problem_id}/submit",
            headers=student_headers,
            json={"code": "", "language": "python"}
        )
        assert response.status_code == 422

    def test_code_execution_disabled_in_hosted_modes(self, client, student_headers, problem_id, monkeypatch):
        monkeypatch.setenv("APP_ENV", "production")
        response = client.post(
            f"/api/student/problems/{problem_id}/submit",
            headers=student_headers,
            json={"code": "pass", "language": "python"},
        )
        assert response.status_code == 503
        assert "hardened sandbox" in response.json()["detail"]

    def test_submit_invalid_language_returns_422(self, client, student_headers, problem_id):
        """Invalid language should be rejected with 422."""
        response = client.post(
            f"/api/student/problems/{problem_id}/submit",
            headers=student_headers,
            json={"code": "print('hi')", "language": "invalid"}
        )
        assert response.status_code == 422

    def test_list_submissions_returns_200(self, client, student_headers):
        """GET /api/student/submissions should return 200."""
        response = client.get("/api/student/submissions", headers=student_headers)
        assert response.status_code == 200

    def test_get_nonexistent_submission_returns_404(self, client, student_headers):
        """GET /api/student/submissions/{id} should return 404 for invalid ID."""
        response = client.get(
            "/api/student/submissions/nonexistent-id",
            headers=student_headers
        )
        assert response.status_code == 404


class TestSandboxSecurity:
    """Tests for code sandbox security.
    
    Note: We test the sandbox directly since API tests may have empty test_cases
    which makes any code that produces output appear to 'pass'.
    """

    def test_blocks_os_import(self):
        """Sandbox should block 'import os'."""
        from app.services.sandbox import CodeSandbox
        sandbox = CodeSandbox()
        result = sandbox.execute("import os; print(os.getcwd())")
        assert result.status == "error"
        assert "not allowed" in result.stderr.lower() or "os" in result.stderr

    def test_blocks_subprocess_import(self):
        """Sandbox should block 'import subprocess'."""
        from app.services.sandbox import CodeSandbox
        sandbox = CodeSandbox()
        result = sandbox.execute("import subprocess")
        assert result.status == "error"

    def test_blocks_socket_import(self):
        """Sandbox should block 'import socket'."""
        from app.services.sandbox import CodeSandbox
        sandbox = CodeSandbox()
        result = sandbox.execute("import socket")
        assert result.status == "error"

    def test_allows_safe_imports(self):
        """Sandbox should allow safe imports like math."""
        from app.services.sandbox import CodeSandbox
        sandbox = CodeSandbox()
        result = sandbox.execute("import math; print(math.pi)")
        # Should succeed and output pi
        assert result.status == "success"
        assert "3.14" in result.stdout

    def test_blocks_file_operations(self):
        """Sandbox should block file operations."""
        from app.services.sandbox import CodeSandbox
        sandbox = CodeSandbox()
        result = sandbox.execute("open('/etc/passwd', 'r').read()")
        assert result.status == "error"

    def test_handles_syntax_error(self):
        """Sandbox should handle syntax errors gracefully."""
        from app.services.sandbox import CodeSandbox
        sandbox = CodeSandbox()
        result = sandbox.execute("print('unclosed")
        assert result.status in ("error", "runtime_error")

    def test_handles_runtime_error(self):
        """Sandbox should handle runtime errors gracefully."""
        from app.services.sandbox import CodeSandbox
        sandbox = CodeSandbox()
        result = sandbox.execute("x = 1 / 0")
        assert result.status in ("error", "runtime_error")
        assert "ZeroDivisionError" in result.stderr


class TestTeacherAnalyticsAPI:
    """Tests for teacher analytics endpoints."""

    @pytest.fixture
    def classroom_id(self, client, teacher_headers):
        """Create a classroom and return its ID."""
        response = client.post(
            "/api/classrooms",
            headers=teacher_headers,
            json={"name": "Test Analytics Classroom", "description": "For testing"}
        )
        if response.status_code == 201:
            return response.json()["id"]
        return None

    def test_classroom_analytics_returns_200(self, client, teacher_headers, classroom_id):
        """GET /api/teacher/classrooms/{id}/analytics should return 200."""
        if classroom_id is None:
            pytest.skip("Could not create classroom")

        response = client.get(
            f"/api/teacher/classrooms/{classroom_id}/analytics",
            headers=teacher_headers
        )
        assert response.status_code == 200

    def test_analytics_response_structure(self, client, teacher_headers, classroom_id):
        """Analytics response should have correct structure."""
        if classroom_id is None:
            pytest.skip("Could not create classroom")

        response = client.get(
            f"/api/teacher/classrooms/{classroom_id}/analytics",
            headers=teacher_headers
        )
        data = response.json()

        assert "classroom_id" in data
        assert "student_count" in data
        assert "total_attempts" in data
        assert "average_accuracy" in data
        assert "common_weak_topics" in data
