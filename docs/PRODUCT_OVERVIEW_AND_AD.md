# LessonFoundry — Product Overview & Advertisement Brief

> **Status note:** The adaptive-learning section below describes a local prototype and the intended ad story, not a production-ready release claim. The latest acceptance journey used synthetic content and a mock provider. Coding challenges remain generic placeholders, and code execution is disabled in staging/production until a hardened sandbox is deployed. Do not film or advertise these adaptive capabilities as live until the validation blockers in [Adaptive Learning Validation](ADAPTIVE_LEARNING_VALIDATION.md) are cleared.

## What is LessonFoundry?

LessonFoundry is a teacher-controlled learning platform that helps educators turn trusted course material into clear, aligned learning experiences. Teachers bring their own source materials, define learning objectives, and create a connected pack of explanations, examples, practice, quizzes, and revision resources. LessonFoundry keeps the material tied to its sources and objectives, while teachers review and approve it before it is shared with students.

The local prototype now includes the intended adaptive-learning journey: classroom-scoped assessment results surface topics for practice, approved classroom assets can be retrieved, and a three-day plan records activity completion. A linked coding-challenge UI also displays submission feedback in development. These flows have only been checked with synthetic/mock data; lesson relevance and challenge quality are not yet validated against real classroom material, and hosted code execution is deliberately disabled pending sandbox hardening.

**In one sentence:** LessonFoundry helps teachers create trusted learning materials and helps students know what to learn next.

## The problem we solve

Creating a complete lesson takes time: teachers often prepare explanations, examples, quizzes, answer keys, and differentiated practice separately. Generic AI tools can produce material that is inconsistent, disconnected from the syllabus, or difficult to verify. Students, meanwhile, may know their score but not which concept to revisit or what to do next.

LessonFoundry brings content creation, review, practice, and targeted follow-up into one workflow—without removing the teacher from the decision-making process.

## How it works

1. **Start with trusted material.** A teacher adds course content and learning objectives.
2. **Build a connected learning pack.** LessonFoundry supports generation and organization of explanations, examples, quizzes, practice, and revision resources.
3. **Review before sharing.** Teachers inspect evidence, quality checks, and versions, then approve what students can see.
4. **Learn from assessment.** Student results can identify topics for additional support.
5. **Make a practical next-step plan.** Relevant materials and a structured three-day remedial schedule help students focus their revision.
6. **Coding practice (release goal; not production-ready).** The intended experience is topic-aligned problems with useful feedback. The current local template and subprocess runner are insufficient for a live student feature; hosted code execution is disabled pending meaningful challenge review and sandbox hardening.
7. **Reassess and continue.** Progress provides a basis for deciding what to practice next.

## Who benefits?

- **Teachers** spend less time assembling repetitive learning materials and retain control over accuracy, approval, and what is published.
- **Students** receive approved materials, focused revision guidance, and actionable practice rather than a one-size-fits-all pile of content.
- **Schools and learning teams** gain a more consistent workflow connecting curriculum, assessment, and follow-up learning.

## What makes LessonFoundry different?

- **Teacher control:** generated content is reviewed and approved before it reaches the student surface.
- **Traceability:** content can be connected to its source material, learning objective, and version.
- **Connected learning assets:** explanations, questions, answer keys, and practice belong to a coherent learning pack.
- **Personalized follow-up:** assessment signals can inform topic-focused materials and a three-day plan.
- **Practice that teaches:** coding evaluation is intended to return useful feedback, not merely a pass/fail result.

## Short product description

LessonFoundry's product direction is a teacher-controlled platform that turns trusted curriculum materials into reviewed learning packs, then helps students act on assessment results through relevant revision plans and coding practice. Adaptive workflows are still in local validation and should not be presented as release capability until their content and security blockers are cleared.

## 60-second advertisement video

**Status:** Conditional storyboard only. Exact 24 fps frame ranges, keyframes, and capture gates are in [FRAME-BY-FRAME-PLAN.md](../ai%20video/ad-production/FRAME-BY-FRAME-PLAN.md). Do not capture the adaptive-learning scenes until real classroom matching, plan tracking, challenge quality, and sandbox safety are verified in the release configuration.

**Audience:** teachers, schools, education partners  
**Tone:** confident, human, practical; avoid portraying AI as a replacement for teachers.

| Time | Visual beat | Voiceover / on-screen text |
|---|---|---|
| 0–4s | Student closes a quiz and wonders what to work on next. | **VO:** “A score tells you how you did. What should you work on next?” |
| 4–11s | Real student view surfaces a weak topic from classroom assessment results. | **VO:** “LessonFoundry helps surface the topics that need another look.” |
| 11–20s | Show one approved lesson match with source provenance. | **VO:** “Then it points students back to approved classroom material.” **HOLD until real matches are verified.** |
| 20–31s | Three-day plan; student completes an activity and progress updates. | **VO:** “A focused three-day plan turns that insight into a next step.” |
| 31–42s | Conditional coding challenge and readable feedback. | **VO:** “And coding practice can help students learn from each attempt.” **DO NOT FILM until meaningful challenges and a hardened sandbox pass review.** |
| 42–51s | Supporting teacher review, approval, and publish workflow. | **VO:** “Teachers stay in control of what reaches their students.” |
| 51–56s | Student opens the published classroom pack. | **VO:** “One connected path from classroom material to practice.” |
| 56–60s | Official brand end card. | **VO:** “LessonFoundry. Trusted learning, built together.” |

### 30-second cutdown

**Conditional on the same release and security gates:** retain the student weak-topic → verified approved lesson → tracked three-day plan sequence. Omit coding execution until the hardened sandbox and meaningful, teacher-reviewed challenges are ready. Close on the official LessonFoundry end card.

## Production notes

- Use actual LessonFoundry screens and real, non-sensitive demo accounts/data. Do not show student personal information.
- Show teacher approval as a real decision point; do not imply autonomous publishing.
- Make the sequence legible on mobile: short captions, large type, high contrast, and burned-in subtitles.
- Prefer authentic product footage and a teacher/student voice. Keep music warm and understated.
- Use “helps identify,” “supports,” and “provides feedback”; avoid claims of guaranteed learning gains or perfect AI accuracy.
- Treat the current adaptive screens as internal demo/test footage only. Mock-provider output is not evidence of semantic curriculum alignment.
- Do not show coding execution in a release ad until the hardened sandbox and meaningful, reviewed challenges have passed independent validation.
- The local MVP documentation records that hosted integrations and production certification remain outstanding. Do not advertise live hosted service, guaranteed security, or integrations that have not been verified in the target deployment.

## Evidence and claim boundaries

This is a product and creative brief, not a certification report. The repository documents a local LessonFoundry MVP and adaptive-learning implementation, along with test reports. The base platform README explicitly says it is not production-certified and notes that hosted Supabase verification is blocked by missing staging configuration. Claims in external marketing should be limited to features demonstrated in the actual release being filmed. In particular, do not claim that every student journey has been validated against live production infrastructure unless that has been separately verified.

For implementation and validation specifics, see [Adaptive Learning Validation](ADAPTIVE_LEARNING_VALIDATION.md), [Adaptive Learning Design](ADAPTIVE_LEARNING_DESIGN.md), and [README](../README.md).
