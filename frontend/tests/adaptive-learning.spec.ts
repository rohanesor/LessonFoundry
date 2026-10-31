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
// Student-role routes must be called with the student token. Using the teacher
// token here correctly returns 403 (role enforcement), which hid real results.
const STUDENT_TOKEN = process.env.ADAPTIVE_TEST_STUDENT_TOKEN ?? "local-student-only";

// Shared across both describe blocks (run serially, one worker).
let sharedPackId = "";

const NEWTON_SOURCE = `Newton's Laws of Motion — teacher-authored demonstration notes.
Newton's first law: an object remains at rest or moves with constant velocity unless acted on by a nonzero resultant external force. Inertia is resistance to a change in velocity. Mass measures inertia.
Newton's second law: for a constant-mass object in an inertial frame, the resultant external force F equals mass m multiplied by acceleration a: F = ma. The SI unit of force is the newton. A 2 kg object with acceleration 3 m/s² experiences a resultant force of 6 N.
Newton's third law: when one body exerts a force on a second body, the second exerts an equal and opposite force on the first. These forces act on different bodies and do not cancel on a single-body free-body diagram.`;

test.describe("Adaptive Learning Integration", () => {
  let packId: string;
  let classroomId: string;
  let studentToken: string;

  test.beforeAll(async ({ request }) => {
    // 1. Classroom first, then a pack created *in* that classroom. A pack can only
    //    be assigned at creation (no PATCH route), and only classroom packs can be
    //    published to students.
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

    const created = await request.post(`${API}/api/packs`, {
      headers: teacherAuth,
      data: {
        title: "Adaptive Newton Pack",
        objectives: [
          "Explain Newton's three laws of motion",
          "Solve force and acceleration problems",
          "Interpret free-body diagrams",
        ],
        classroom_id: classroomId,
      },
    });
    expect(created.status()).toBe(201);
    packId = (await created.json()).id;
    sharedPackId = packId;

    // 2. Source material, gap check, generation (the real teacher workflow).
    const upload = await request.post(`${API}/api/packs/${packId}/sources`, {
      headers: teacherAuth,
      multipart: {
        file: {
          name: "newton-notes.txt",
          mimeType: "text/plain",
          buffer: Buffer.from(NEWTON_SOURCE),
        },
      },
    });
    expect(upload.status()).toBeLessThan(300);

    await request.post(`${API}/api/packs/${packId}/gap-check`, { headers: teacherAuth });
    await expect
      .poll(
        async () => {
          const p = await (
            await request.get(`${API}/api/packs/${packId}`, { headers: teacherAuth })
          ).json();
          return p.jobs?.[0]?.state;
        },
        { timeout: 30000 },
      )
      .toBe("Succeeded");

    await request.post(`${API}/api/packs/${packId}/generate`, { headers: teacherAuth });
    await expect
      .poll(
        async () => {
          const p = await (
            await request.get(`${API}/api/packs/${packId}`, { headers: teacherAuth })
          ).json();
          return p.assets?.length >= 5;
        },
        { timeout: 30000 },
      )
      .toBe(true);

    // 3. Approve and publish (publish requires every current asset approved).
    const packDetail = await (
      await request.get(`${API}/api/packs/${packId}`, { headers: teacherAuth })
    ).json();
    const approve = await request.post(`${API}/api/packs/${packId}/approve`, {
      headers: teacherAuth,
      data: {
        expected_revision: packDetail.revision,
        note: "Reviewed for adaptive learning integration test.",
      },
    });
    expect(approve.status()).toBe(200);
    const publish = await request.post(`${API}/api/packs/${packId}/publish`, {
      headers: teacherAuth,
    });
    expect(publish.status()).toBe(200);

    // 4. Student joins by classroom code (student-role route).
    const join = await request.post(`${API}/api/join`, {
      headers: { Authorization: `Bearer ${STUDENT_TOKEN}` },
      data: { code: classroomData.join_code },
    });
    expect([200, 201, 409]).toContain(join.status());

    studentToken = STUDENT_TOKEN;

    // 5. Record real quiz attempts through the student answer route so the
    //    adaptive planner works from actual scores, not an empty history.
    const studentPack = await (
      await request.get(`${API}/api/student/packs/${packId}`, {
        headers: { Authorization: `Bearer ${STUDENT_TOKEN}` },
      })
    ).json();
    const quizzes = studentPack.assets.filter((a: { slot: string }) =>
      a.slot.startsWith("quiz"),
    );
    expect(quizzes.length).toBeGreaterThan(0);
    for (const q of quizzes) {
      const answer = await request.post(
        `${API}/api/student/packs/${packId}/answers/${q.id}`,
        {
          headers: { Authorization: `Bearer ${STUDENT_TOKEN}` },
          data: { choice: 0 },
        },
      );
      expect(answer.status()).toBe(200);
    }
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
        unit_id: sharedPackId,
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
        unit_id: sharedPackId,
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
        unit_id: sharedPackId,
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
    const studentAuth = { Authorization: `Bearer ${STUDENT_TOKEN}` };

    const response = await request.get(
      `${API}/api/student/learning-plans/non-existent-id`,
      { headers: studentAuth },
    );

    expect(response.status()).toBe(404);
  });

  test("Returns 404 for non-existent problem", async ({ request }) => {
    const studentAuth = { Authorization: `Bearer ${STUDENT_TOKEN}` };

    const response = await request.get(
      `${API}/api/student/problems/non-existent-id`,
      { headers: studentAuth },
    );

    expect(response.status()).toBe(404);
  });

  test("Returns 404 for non-existent submission", async ({ request }) => {
    const studentAuth = { Authorization: `Bearer ${STUDENT_TOKEN}` };

    const response = await request.get(
      `${API}/api/student/submissions/non-existent-id`,
      { headers: studentAuth },
    );

    expect(response.status()).toBe(404);
  });

  test("Validates code submission input", async ({ request }) => {
    const studentAuth = { Authorization: `Bearer ${STUDENT_TOKEN}` };

    // Create a problem first
    const teacherAuth = { Authorization: "Bearer local-development-only" };
    const problemResponse = await request.post(`${API}/api/teacher/problems`, {
      headers: teacherAuth,
      data: { unit_id: sharedPackId, topic: "validation-test", difficulty: "easy" },
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
    const studentAuth = { Authorization: `Bearer ${STUDENT_TOKEN}` };

    // Create a problem first
    const teacherAuth = { Authorization: "Bearer local-development-only" };
    const problemResponse = await request.post(`${API}/api/teacher/problems`, {
      headers: teacherAuth,
      data: { unit_id: sharedPackId, topic: "lang-test", difficulty: "easy" },
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
