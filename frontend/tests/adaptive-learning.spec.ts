import { test, expect } from "@playwright/test";

/**
 * Adaptive Syllabus Coach & Debug Tutor — Playwright Integration Tests
 *
 * Tests all four requirements:
 * 1. Read weak topics from test scores
 * 2. Retrieve matching curriculum segments
 * 3. Build a 3-day remedial schedule
 * 4. Auto-generate problem, run code in sandbox, give feedback
 */

const API = "http://127.0.0.1:8000";
const teacherAuth = { Authorization: "Bearer local-development-only" };

test.describe("Adaptive Learning Integration", () => {
  let packId: string;
  let classroomId: string;
  let studentToken: string;

  test.beforeAll(async ({ request }) => {
    // Create a demo pack with quiz content
    const demo = await request.post(`${API}/api/demo`, {
      headers: teacherAuth,
    });
    expect(demo.status()).toBe(201);
    const demoData = await demo.json();
    packId = demoData.id;

    // Wait for demo pack processing
    await expect
      .poll(
        async () => {
          const p = await (
            await request.get(`${API}/api/packs/${packId}`, {
              headers: teacherAuth,
            })
          ).json();
          return p.jobs?.[0]?.state;
        },
        { timeout: 30000 },
      )
      .toBe("Succeeded");

    // Generate learning pack content
    await request.post(`${API}/api/packs/${packId}/generate`, {
      headers: teacherAuth,
    });

    // Wait for assets to be generated
    await expect
      .poll(
        async () => {
          const p = await (
            await request.get(`${API}/api/packs/${packId}`, {
              headers: teacherAuth,
            })
          ).json();
          return p.assets?.length >= 5;
        },
        { timeout: 30000 },
      )
      .toBe(true);

    // Create a classroom for adaptive learning tests
    const classroom = await request.post(`${API}/api/classrooms`, {
      headers: teacherAuth,
      data: {
        name: "Adaptive Learning Test Classroom",
        description: "Test classroom for adaptive learning validation",
      },
    });
    expect(classroom.status()).toBe(201);
    const classroomData = await classroom.json();
    classroomId = classroomData.id;

    // Assign pack to classroom
    await request.patch(`${API}/api/packs/${packId}`, {
      headers: teacherAuth,
      data: { classroom_id: classroomId },
    });

    // For testing, we use the teacher token as student
    // In production, this would be a separate student auth
    studentToken = "local-development-only";
  });

  test("Requirement 1: Read weak topics from student quiz performance", async ({
    request,
  }) => {
    const studentAuth = { Authorization: `Bearer ${studentToken}` };

    // Get student performance report
    const response = await request.get(
      `${API}/api/student/performance?classroom_id=${classroomId}`,
      { headers: studentAuth },
    );

    // Should return 200 even if no attempts yet
    expect(response.status()).toBe(200);

    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty("total_attempts");
    expect(data).toHaveProperty("overall_accuracy");
    expect(data).toHaveProperty("weak_topics");
    expect(data).toHaveProperty("strong_topics");

    // Verify types
    expect(typeof data.total_attempts).toBe("number");
    expect(typeof data.overall_accuracy).toBe("number");
    expect(Array.isArray(data.weak_topics)).toBe(true);
    expect(Array.isArray(data.strong_topics)).toBe(true);
  });

  test("Requirement 2: Retrieve curriculum segments for weak topics", async ({
    request,
  }) => {
    const studentAuth = { Authorization: `Bearer ${studentToken}` };

    // Get remedial content
    const response = await request.get(
      `${API}/api/student/remedial-content?classroom_id=${classroomId}`,
      { headers: studentAuth },
    );

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty("results");
    expect(Array.isArray(data.results)).toBe(true);

    // Each result should have weak_topic and segments
    for (const result of data.results) {
      expect(result).toHaveProperty("weak_topic");
      expect(result).toHaveProperty("segments");
      expect(Array.isArray(result.segments)).toBe(true);
    }
  });

  test("Requirement 3: Generate 3-day learning plan", async ({ request }) => {
    const studentAuth = { Authorization: `Bearer ${studentToken}` };

    // Create a learning plan
    const createResponse = await request.post(
      `${API}/api/student/learning-plans`,
      {
        headers: studentAuth,
        data: { classroom_id: classroomId },
      },
    );

    // Should create successfully (201) or conflict if plan exists (409)
    expect([201, 409]).toContain(createResponse.status());

    if (createResponse.status() === 201) {
      const planData = await createResponse.json();

      // Verify plan structure
      expect(planData).toHaveProperty("plan_id");
      expect(planData).toHaveProperty("weak_topics");
      expect(planData).toHaveProperty("days");

      // Verify exactly 3 days
      expect(planData.days).toHaveLength(3);

      // Verify each day has required fields
      for (const day of planData.days) {
        expect(day).toHaveProperty("day");
        expect(day).toHaveProperty("focus");
        expect(day).toHaveProperty("activity_count");
        expect([1, 2, 3]).toContain(day.day);
        expect(day.activity_count).toBeGreaterThan(0);
      }

      // List plans to verify persistence
      const listResponse = await request.get(
        `${API}/api/student/learning-plans?classroom_id=${classroomId}`,
        { headers: studentAuth },
      );
      expect(listResponse.status()).toBe(200);

      const plans = await listResponse.json();
      expect(Array.isArray(plans)).toBe(true);
      expect(plans.length).toBeGreaterThan(0);

      // Get plan details
      const detailResponse = await request.get(
        `${API}/api/student/learning-plans/${planData.plan_id}`,
        { headers: studentAuth },
      );
      expect(detailResponse.status()).toBe(200);
    }
  });

  test("Requirement 4a: Create coding problem (teacher)", async ({
    request,
  }) => {
    // Teacher creates a coding problem
    const response = await request.post(`${API}/api/teacher/problems`, {
      headers: teacherAuth,
      data: {
        topic: "loops",
        difficulty: "easy",
      },
    });

    expect(response.status()).toBe(201);

    const problem = await response.json();
    expect(problem).toHaveProperty("id");
    expect(problem).toHaveProperty("topic", "loops");
    expect(problem).toHaveProperty("difficulty", "easy");
    expect(problem).toHaveProperty("title");

    // List problems to verify
    const listResponse = await request.get(`${API}/api/teacher/problems`, {
      headers: teacherAuth,
    });
    expect(listResponse.status()).toBe(200);

    const problems = await listResponse.json();
    expect(Array.isArray(problems)).toBe(true);
  });

  test("Requirement 4b: Submit code and get feedback", async ({ request }) => {
    const studentAuth = { Authorization: `Bearer ${studentToken}` };

    // First, create a problem
    const problemResponse = await request.post(`${API}/api/teacher/problems`, {
      headers: teacherAuth,
      data: {
        topic: "functions",
        difficulty: "medium",
      },
    });
    expect(problemResponse.status()).toBe(201);
    const problem = await problemResponse.json();

    // Get problem details as student
    const getResponse = await request.get(
      `${API}/api/student/problems/${problem.id}`,
      { headers: studentAuth },
    );
    expect(getResponse.status()).toBe(200);

    const problemDetails = await getResponse.json();
    expect(problemDetails).toHaveProperty("id");
    expect(problemDetails).toHaveProperty("description");
    expect(problemDetails).toHaveProperty("starter_code");
    // Solution should NOT be exposed to student
    expect(problemDetails).not.toHaveProperty("solution");
    expect(problemDetails).not.toHaveProperty("test_cases");

    // Submit code
    const submitResponse = await request.post(
      `${API}/api/student/problems/${problem.id}/submit`,
      {
        headers: studentAuth,
        data: {
          code: "print('Hello, World!')",
          language: "python",
        },
      },
    );

    expect(submitResponse.status()).toBe(200);

    const submission = await submitResponse.json();
    expect(submission).toHaveProperty("submission_id");
    expect(submission).toHaveProperty("status");
    expect(submission).toHaveProperty("feedback");
    expect(submission).toHaveProperty("passed_count");
    expect(submission).toHaveProperty("total_count");
    expect(submission).toHaveProperty("test_results");

    // Verify status is one of expected values
    expect(["passed", "failed", "error", "timeout"]).toContain(submission.status);

    // List submissions
    const listResponse = await request.get(
      `${API}/api/student/submissions?problem_id=${problem.id}`,
      { headers: studentAuth },
    );
    expect(listResponse.status()).toBe(200);

    const submissions = await listResponse.json();
    expect(Array.isArray(submissions)).toBe(true);
    expect(submissions.length).toBeGreaterThan(0);

    // Get submission details
    const detailResponse = await request.get(
      `${API}/api/student/submissions/${submission.submission_id}`,
      { headers: studentAuth },
    );
    expect(detailResponse.status()).toBe(200);
  });

  test("Requirement 4c: Code sandbox blocks dangerous operations", async ({
    request,
  }) => {
    const studentAuth = { Authorization: `Bearer ${studentToken}` };

    // Create a problem for testing
    const problemResponse = await request.post(`${API}/api/teacher/problems`, {
      headers: teacherAuth,
      data: {
        topic: "security-test",
        difficulty: "easy",
      },
    });
    const problem = await problemResponse.json();

    // Test 1: Try to import os (should be blocked)
    const osImportResponse = await request.post(
      `${API}/api/student/problems/${problem.id}/submit`,
      {
        headers: studentAuth,
        data: {
          code: "import os; print(os.getcwd())",
          language: "python",
        },
      },
    );
    expect(osImportResponse.status()).toBe(200);
    const osResult = await osImportResponse.json();
    expect(osResult.status).toBe("error");

    // Test 2: Try to import subprocess (should be blocked)
    const subprocessResponse = await request.post(
      `${API}/api/student/problems/${problem.id}/submit`,
      {
        headers: studentAuth,
        data: {
          code: "import subprocess; subprocess.run(['ls'])",
          language: "python",
        },
      },
    );
    expect(subprocessResponse.status()).toBe(200);
    const subprocessResult = await subprocessResponse.json();
    expect(subprocessResult.status).toBe("error");
  });

  test("Teacher classroom analytics endpoint", async ({ request }) => {
    // Get classroom analytics
    const response = await request.get(
      `${API}/api/teacher/classrooms/${classroomId}/analytics`,
      { headers: teacherAuth },
    );

    expect(response.status()).toBe(200);

    const analytics = await response.json();
    expect(analytics).toHaveProperty("classroom_id");
    expect(analytics).toHaveProperty("student_count");
    expect(analytics).toHaveProperty("total_attempts");
    expect(analytics).toHaveProperty("average_accuracy");
    expect(analytics).toHaveProperty("common_weak_topics");
  });

  test("Student quiz attempts are recorded", async ({ request }) => {
    const studentAuth = { Authorization: `Bearer ${studentToken}` };

    // Get student attempts
    const response = await request.get(
      `${API}/api/student/attempts?classroom_id=${classroomId}`,
      { headers: studentAuth },
    );

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("attempts");
    expect(Array.isArray(data.attempts)).toBe(true);

    // Each attempt should have required fields
    for (const attempt of data.attempts) {
      expect(attempt).toHaveProperty("id");
      expect(attempt).toHaveProperty("unit_id");
      expect(attempt).toHaveProperty("slot");
      expect(attempt).toHaveProperty("is_correct");
      expect(attempt).toHaveProperty("attempted_at");
    }
  });
});

test.describe("Adaptive Learning Error Handling", () => {
  test("Returns 404 for non-existent learning plan", async ({ request }) => {
    const studentAuth = { Authorization: "Bearer local-development-only" };

    const response = await request.get(
      `${API}/api/student/learning-plans/non-existent-id`,
      { headers: studentAuth },
    );

    expect(response.status()).toBe(404);
  });

  test("Returns 404 for non-existent problem", async ({ request }) => {
    const studentAuth = { Authorization: "Bearer local-development-only" };

    const response = await request.get(
      `${API}/api/student/problems/non-existent-id`,
      { headers: studentAuth },
    );

    expect(response.status()).toBe(404);
  });

  test("Returns 404 for non-existent submission", async ({ request }) => {
    const studentAuth = { Authorization: "Bearer local-development-only" };

    const response = await request.get(
      `${API}/api/student/submissions/non-existent-id`,
      { headers: studentAuth },
    );

    expect(response.status()).toBe(404);
  });

  test("Validates code submission input", async ({ request }) => {
    const studentAuth = { Authorization: "Bearer local-development-only" };

    // Create a problem first
    const teacherAuth = { Authorization: "Bearer local-development-only" };
    const problemResponse = await request.post(`${API}/api/teacher/problems`, {
      headers: teacherAuth,
      data: { topic: "validation-test", difficulty: "easy" },
    });
    const problem = await problemResponse.json();

    // Submit with empty code (should fail validation)
    const response = await request.post(
      `${API}/api/student/problems/${problem.id}/submit`,
      {
        headers: studentAuth,
        data: {
          code: "",
          language: "python",
        },
      },
    );

    expect(response.status()).toBe(422);
  });

  test("Validates language input", async ({ request }) => {
    const studentAuth = { Authorization: "Bearer local-development-only" };

    // Create a problem first
    const teacherAuth = { Authorization: "Bearer local-development-only" };
    const problemResponse = await request.post(`${API}/api/teacher/problems`, {
      headers: teacherAuth,
      data: { topic: "lang-test", difficulty: "easy" },
    });
    const problem = await problemResponse.json();

    // Submit with invalid language
    const response = await request.post(
      `${API}/api/student/problems/${problem.id}/submit`,
      {
        headers: studentAuth,
        data: {
          code: "print('hello')",
          language: "invalid-language",
        },
      },
    );

    expect(response.status()).toBe(422);
  });
});
