"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LessonFoundryLogo } from "@/components/icons/brand";

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    role: "teacher",
    institution_type: "school",
    institution_name: "",
    grade_level: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{
      name?: string;
      role?: string;
      institution_type?: string;
      institution_name?: string;
      grade_level?: string;
    }>("/me")
      .then((me) => {
        setForm((prev) => ({
          ...prev,
          name: me.name && me.name !== "User" ? me.name : prev.name,
          role: me.role === "student" ? "student" : "teacher",
          institution_type: me.institution_type || prev.institution_type,
          institution_name: me.institution_name || prev.institution_name,
          grade_level: me.grade_level || prev.grade_level,
        }));
      })
      .catch(() => {});
  }, []);

  const set = (key: string, value: string) =>
    setForm((x) => ({ ...x, [key]: value }));

  return (
    <main className="onboarding-page">
      <div className="onboarding-card">
        <LessonFoundryLogo height={24} />
        <div className="kicker">First-run setup</div>
        <h1>Tell us about yourself</h1>
        <p className="muted">
          This helps LessonFoundry personalize your classrooms and learning packs.
        </p>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("/me", {
                method: "PATCH",
                body: JSON.stringify({ ...form, onboarding_completed: true }),
              });
              router.replace(form.role === "student" ? "/student" : "/teacher");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Full name
            <input
              className="input"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Richard Feynman"
            />
          </label>
          <label>
            I am joining as
            <select
              className="input"
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
            >
              <option value="teacher">Teacher / Educator</option>
              <option value="student">Student / Learner</option>
            </select>
          </label>
          <label>
            Institution type
            <select
              className="input"
              value={form.institution_type}
              onChange={(e) => set("institution_type", e.target.value)}
            >
              <option value="school">School</option>
              <option value="college">College / University</option>
              <option value="independent">Independent / Coaching</option>
            </select>
          </label>
          <label>
            Institution name
            <input
              className="input"
              required
              minLength={3}
              value={form.institution_name}
              onChange={(e) => set("institution_name", e.target.value)}
              placeholder="e.g. Stanford University or Delhi Public School"
            />
          </label>
          <label>
            Grade / level / department
            <input
              className="input"
              required
              value={form.grade_level}
              onChange={(e) => set("grade_level", e.target.value)}
              placeholder="e.g. Class 11 or Physics Dept"
            />
          </label>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <Button variant="default" disabled={busy}>
            {busy ? "Saving…" : "Continue to Dashboard →"}
          </Button>
        </form>
      </div>
    </main>
  );
}
