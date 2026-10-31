import { test, expect, type APIRequestContext, type Browser } from "@playwright/test";

const API = `${process.env.ADAPTIVE_TEST_API_URL || "http://127.0.0.1:8000"}/api`;
const teacherToken = process.env.ADAPTIVE_TEST_TEACHER_TOKEN || "local-development-only";
const studentToken = process.env.ADAPTIVE_TEST_STUDENT_TOKEN || "local-student-only";
const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };
const studentHeaders = { Authorization: `Bearer ${studentToken}` };

async function json<T>(r: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!r.ok()) throw new Error(`${r.status()} ${await r.text()}`);
  return r.json() as Promise<T>;
}

// One sequential browser acceptance journey using separate local teacher/student identities.
test("teacher-approved classroom pack → student adaptive next steps → coding feedback", async ({ request, browser }) => {
  test.setTimeout(240_000);
  const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const studentContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const teacherPage = await teacherContext.newPage();
  const studentPage = await studentContext.newPage();
  const errors: string[] = [];
  for (const page of [teacherPage, studentPage]) {
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  }
  await teacherPage.addInitScript((token) => sessionStorage.setItem("lf-token", token), teacherToken);
  await studentPage.addInitScript((token) => sessionStorage.setItem("lf-token", token), studentToken);

  // Teacher creates a real classroom and classroom-bound pack using the configured local API/worker.
  const classroom = await json<{ id: string; join_code: string }>(await request.post(`${API}/classrooms`, {
    headers: teacherHeaders, data: { name: `Adaptive E2E ${Date.now()}`, description: "Sanitized test classroom" },
  }));
  const pack = await json<{ id: string }>(await request.post(`${API}/packs`, {
    headers: teacherHeaders,
    data: { title: "Forces and motion — adaptive E2E", subject: "Physics", level: "Class 11", objectives: ["Explain force and acceleration", "Describe mass and inertia"], classroom_id: classroom.id },
  }));
  const sourceText = "For an object of constant mass, resultant force equals mass multiplied by acceleration: F = ma. Acceleration is the change in velocity per unit time. Mass measures inertia, the resistance of an object to a change in motion. A 2 kg object accelerating at 3 m/s² has a resultant force of 6 N. Balanced forces have zero resultant force and do not change an object's velocity.";
  await json(await request.post(`${API}/packs/${pack.id}/sources/text`, {
    headers: teacherHeaders, data: { name: "approved-class-notes.txt", text: sourceText },
  }));
  const gap = await request.post(`${API}/packs/${pack.id}/gap-check`, { headers: teacherHeaders });
  expect(gap.status()).toBe(202);
  await expect.poll(async () => {
    const p = await json<{ jobs: { state: string }[] }>(await request.get(`${API}/packs/${pack.id}`, { headers: teacherHeaders }));
    return p.jobs.at(-1)?.state;
  }, { timeout: 45_000 }).toBe("Succeeded");
  const generation = await request.post(`${API}/packs/${pack.id}/generate`, { headers: teacherHeaders });
  expect(generation.status()).toBe(202);
  await expect.poll(async () => {
    const p = await json<{ assets: unknown[]; jobs: { state: string }[] }>(await request.get(`${API}/packs/${pack.id}`, { headers: teacherHeaders }));
    return p.jobs.at(-1)?.state === "Succeeded" && p.assets.length >= 5;
  }, { timeout: 60_000 }).toBe(true);
  const packDetail = await json<{ revision: number; assets: { id: string }[]; objectives: { id: string; description: string }[] }>(await request.get(`${API}/packs/${pack.id}`, { headers: teacherHeaders }));
  // A distinct student identity joins using the actual teacher-issued code.
  const joined = await request.post(`${API}/join`, { headers: studentHeaders, data: { code: classroom.join_code } });
  expect(joined.status(), await joined.text()).toBe(200);
  for (const [headers, profile] of [[teacherHeaders, { name: "E2E Teacher", role: "teacher" }], [studentHeaders, { name: "E2E Student", role: "student" }]] as const) {
    const setup = await request.patch(`${API}/me`, { headers, data: { ...profile, institution_type: "school", institution_name: "LessonFoundry E2E", grade_level: "Class 11", onboarding_completed: true } });
    expect(setup.status(), await setup.text()).toBe(200);
  }
  await teacherPage.goto(`/teacher/packs/${pack.id}`);
  await expect(teacherPage.locator("main")).toBeVisible();
  await teacherPage.getByRole("button", { name: "Overview", exact: true }).click();
  await teacherPage.getByRole("button", { name: "Approve pack", exact: true }).click();
  await teacherPage.getByRole("checkbox").check();
  await teacherPage.getByPlaceholder("Record what you verified").fill("Reviewed approved source materials, objective alignment, questions, and answer keys.");
  await teacherPage.getByRole("button", { name: "Approve version" }).click();
  await expect(teacherPage.getByRole("button", { name: "Publish to classroom" }).first()).toBeVisible();
  await teacherPage.getByRole("button", { name: "Publish to classroom" }).first().click();
  await expect(teacherPage.getByRole("dialog", { name: "Publish to classroom" })).toBeVisible();
  await teacherPage.getByRole("button", { name: "Confirm publication" }).click();
  await expect(teacherPage.getByText("Published", { exact: true }).first()).toBeVisible();
  await studentPage.goto(`/student/classrooms/${classroom.id}`);
  await expect(studentPage.getByRole("heading", { name: "What to work on next" })).toBeVisible();

  // Case 1: student completes a real published quiz in the browser; the response persists.
  await studentPage.getByRole("link", { name: "Forces and motion — adaptive E2E" }).click();
  await studentPage.getByRole("button", { name: "Practice", exact: true }).click();
  const firstQuestion = studentPage.locator("section.card").filter({ has: studentPage.locator('input[type="radio"]') }).first();
  await firstQuestion.locator('input[type="radio"]').first().check();
  await firstQuestion.getByRole("button", { name: "Check answer" }).click();
  await expect(firstQuestion.getByRole("status")).toContainText(/Correct|Not quite/);
  const studentPack = await json<{ assets: { id: string; slot: string }[] }>(await request.get(`${API}/student/packs/${pack.id}`, { headers: studentHeaders }));
  const teacherPack = await json<{ assets: { slot: string; payload: { answer: number } }[] }>(await request.get(`${API}/packs/${pack.id}`, { headers: teacherHeaders }));
  const quiz = studentPack.assets.filter(a => a.slot.startsWith("quiz"));
  expect(quiz.length).toBeGreaterThanOrEqual(2);
  for (const q of quiz) {
    // Derive an incorrect choice from the teacher-only answer key; never expose it to the student.
    const answerKey = teacherPack.assets.find(a => a.slot === q.slot)?.payload.answer ?? 0;
    const incorrectChoice = (answerKey + 1) % 4;
    const first = await request.post(`${API}/student/packs/${pack.id}/answers/${q.id}`, { headers: studentHeaders, data: { choice: incorrectChoice } });
    expect(first.status(), await first.text()).toBe(200);
    const second = await request.post(`${API}/student/packs/${pack.id}/answers/${q.id}`, { headers: studentHeaders, data: { choice: incorrectChoice } });
    expect(second.status(), await second.text()).toBe(200);
  }
  const performance = await json<{ total_attempts: number; weak_topics: { description: string; accuracy: number }[] }>(await request.get(`${API}/student/performance?classroom_id=${classroom.id}`, { headers: studentHeaders }));
  expect(performance.total_attempts).toBeGreaterThanOrEqual(2);
  expect(performance.weak_topics.length).toBeGreaterThan(0);
  await studentPage.goto(`/student/classrooms/${classroom.id}`);
  await expect(studentPage.getByText(/Topics to practice/)).toBeVisible();
  await expect(studentPage.getByText(performance.weak_topics[0].description, { exact: true }).first()).toBeVisible();

  // Case 2: retrieved lessons must be approved, published, and from this classroom.
  const content = await json<{ results: { weak_topic: { description: string }; segments: { title: string; unit_title: string; asset_version_id: string }[] }[] }>(await request.get(`${API}/student/remedial-content?classroom_id=${classroom.id}`, { headers: studentHeaders }));
  expect(content.results.length).toBeGreaterThan(0);
  expect(content.results.some(r => r.segments.some(s => s.asset_version_id && s.unit_title === "Forces and motion — adaptive E2E"))).toBeTruthy();
  await expect(studentPage.getByRole("heading", { name: "Matched approved lessons" })).toBeVisible();
  await expect(studentPage.getByText("Forces and motion — adaptive E2E").first()).toBeVisible();
  await studentPage.screenshot({ path: "test-results/adaptive-01-weak-topics-approved-content.png", fullPage: true });

  // Case 3: plan is persisted and has exactly three populated days linked to the weak topics.
  const planResponse = await request.post(`${API}/student/learning-plans`, { headers: studentHeaders, data: { classroom_id: classroom.id } });
  expect(planResponse.status(), await planResponse.text()).toBe(201);
  const created = await json<{ plan_id: string; days: { day: number; activity_count: number }[]; weak_topics: { description: string }[] }>(planResponse);
  expect(created.days.map(d => d.day)).toEqual([1, 2, 3]);
  expect(created.days.every(d => d.activity_count > 0)).toBeTruthy();
  expect(created.weak_topics.map(t => t.description)).toEqual(expect.arrayContaining(performance.weak_topics.map(t => t.description)));
  const plan = await json<{ days: { day: number; activities: { title: string }[] }[] }>(await request.get(`${API}/student/learning-plans/${created.plan_id}`, { headers: studentHeaders }));
  expect(plan.days).toHaveLength(3);
  expect(plan.days.flatMap(d => d.activities).length).toBeGreaterThan(0);
  await studentPage.reload();
  await studentPage.getByRole("button", { name: "Continue your active plan" }).click();
  for (const n of [1, 2, 3]) await expect(studentPage.getByText(`Day ${n}:`)).toBeVisible();
  const progress = studentPage.getByText(/Progress:/);
  const progressBefore = await progress.innerText();
  const firstActivity = studentPage.locator('input[type="checkbox"]').first();
  if (!(await firstActivity.isChecked())) await firstActivity.click({ noWaitAfter: true });
  await expect(firstActivity).toBeChecked();
  await expect.poll(async () => progress.innerText()).not.toBe(progressBefore);
  await studentPage.screenshot({ path: "test-results/adaptive-02-three-day-plan.png", fullPage: true });

  // Case 4: a classroom-linked challenge is available to this enrolled student;
  // verify incorrect-output and runtime-error feedback through the actual student UI.
  const problemResponse = await request.post(`${API}/teacher/problems`, {
    headers: teacherHeaders, data: { topic: "force and acceleration", difficulty: "easy", unit_id: pack.id },
  });
  expect(problemResponse.status(), await problemResponse.text()).toBe(201);
  const problem = await json<{ id: string; title: string }>(problemResponse);
  const visibleProblems = await json<{ id: string }[]>(await request.get(`${API}/student/problems?classroom_id=${classroom.id}`, { headers: studentHeaders }));
  expect(visibleProblems.some(p => p.id === problem.id)).toBeTruthy();
  await studentPage.reload(); // refresh the classroom-scoped challenge query after teacher authoring
  await expect(studentPage.getByRole("button", { name: new RegExp(problem.title) })).toBeVisible();
  await studentPage.getByRole("button", { name: new RegExp(problem.title) }).click();
  await studentPage.getByLabel("Your Python solution").fill("# valid solution with expected empty output");
  await studentPage.getByRole("button", { name: "Run and get feedback" }).click();
  await expect(studentPage.getByRole("status")).toContainText("all tests passed");
  await studentPage.screenshot({ path: "test-results/adaptive-03-code-success.png", fullPage: true });
  await studentPage.getByLabel("Your Python solution").fill("print('wrong output')");
  await studentPage.getByRole("button", { name: "Run and get feedback" }).click();
  await expect(studentPage.getByRole("status")).toContainText("0/1 tests passed");
  await expect(studentPage.getByRole("status")).toContainText("Hint:");
  await studentPage.screenshot({ path: "test-results/adaptive-04-wrong-output-feedback.png", fullPage: true });
  await studentPage.getByLabel("Your Python solution").fill("raise ValueError('bad input')");
  await studentPage.getByRole("button", { name: "Run and get feedback" }).click();
  await expect(studentPage.getByRole("status")).toContainText(/Runtime Error|Type Error|ValueError/i);
  await studentPage.screenshot({ path: "test-results/adaptive-05-runtime-error-feedback.png", fullPage: true });
  expect(errors).toEqual([]);
  await teacherContext.close();
  await studentContext.close();
});
