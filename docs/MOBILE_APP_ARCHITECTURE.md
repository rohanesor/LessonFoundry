# LessonFoundry — Mobile Application Architecture

## Reusable API Contracts

The mobile client reuses the existing REST API:

| Domain | Endpoint pattern | Mobile screen |
|---|---|---|
| Authentication | `POST /auth/v1/token` (Supabase) | Login |
| Classrooms | `GET /student/classrooms`, `POST /join` | Home, Join |
| Packs | `GET /student/packs/{id}` | Pack viewer |
| Quiz | `POST /student/packs/{id}/answers/{vid}` | Practice |
| PDF | `POST /student/packs/{id}/download` | Offline reading |

Teacher endpoints mirror the web; mobile teacher is a stretch goal.

## Navigation Model

```
Tab bar (student)
├── Home → classroom list
├── Classroom → pack list
├── Pack → Learn / Practice / Revise / Watch / Resources
└── Profile → sign out, settings
```

Navigation state is route-based, not layout-dependent.  The web sidebar
and mobile tab bar are different projections of the same domain state.

## Shared Domain Types

`types/index.ts` exports `Pack`, `Asset`, `Evidence`, `Objective`, `Job`,
`Video`, `Check`, `Payload`, and lifecycle statuses.  These map directly
to mobile data models without transformation.

## Offline & Downloads

- Published PDF is fetched via presigned S3 URL (60-second expiry).
- Mobile client downloads to device storage for offline reading.
- Pack JSON can be cached for offline lesson review.

## Authentication

- Supabase `signInWithPassword` for email/password (same as web).
- Supabase `signInWithIdToken` for native Google/Apple SSO.
- Access token stored in secure keychain, refreshed automatically.

## Content Rendering

- Explanation bodies are plain text / markdown; render with a lightweight
  markdown viewer.
- Flowcharts use structured `nodes[]` / `edges[]`; render with a simple
  native canvas or SVG component.
- Quiz options are plain arrays; render as radio-button lists.

## Teacher Mobile (Future)

- Classroom management, pack status, approval actions.
- Source upload via native camera / file picker.
- Push notifications for generation completion, student joins.

## Security

- No secrets bundled in the mobile binary.
- All API access is token-authenticated.
- S3 objects remain private; presigned URLs are the only access path.
- Student role enforcement is server-side (RLS + API guards).
