# AI Teacher implementation plan (repository-based)

## Existing foundations
- `VideoJob` in `backend/app/models/entities.py` links unit, immutable script version and DB job. `/api/video-jobs` enforces teacher ownership and approved/current video script.
- `backend/app/jobs/worker.py` calls `MockAvatarProvider.create_video`; current simulation returns no MP4.
- `ObjectStore` supports JWT-authorized Supabase/local storage; `S3ObjectStore` provides private SSE uploads and signed downloads. Supabase source policies only allow owner/unit-prefixed source paths and a 10MB bucket: they do NOT support a standalone avatar/video library yet.
- `AssetEditor` provides script draft/version editing and approval. Reuse it, not a parallel script editor.
- Student access uses classroom membership, published asset versions and approved states. Media publication must bind to these exact versions, not merely the latest draft.
- Migration numbering currently ends at 010. No native mobile project exists.

## Ordered implementation
1. Provider contract and deterministic mock adapter. Only configured, server-owned demo media may be selected; no arbitrary URL inputs or paid provider fallback. Keep legacy worker contract compatible. Add provider tests.
2. Route `/teacher/packs/[id]/ai-teacher`, reuse route-bound Studio and AssetEditor for script editing/versioning. Clearly distinguish approved script, workflow simulation, and playable video. Do not expose inert upload/library controls.
3. Migration 011 (after schema review): teacher-owned avatars and videos, script-version-bound pack-video assignment with separate approved and published snapshot references. Owner-only RLS for libraries, limited membership/published assignment policy for student delivery. Local-runtime identities must remain compatible with existing String(36) IDs.
4. Private media upload service: bounded reads, Pillow decoding/dimension limits, video container+codec probing (ffprobe), reject unsupported media; no filename-derived paths; compensating object cleanup. Configure dedicated Supabase media bucket/policies without weakening source policies. Handle local authenticated streaming with range requests, S3/Supabase expiring playback URLs. API responses never expose storage keys.
5. Avatar CRUD/photo profiles, video upload/library/preview/replace endpoints and web screens. Permission tests before UI integration. Obtain teacher confirmation that photo use is authorized; no synthesized likeness claims.
6. Assignment/review/publication: validate ownership of avatar/video/pack and exact approved/current script. Draft replacement never alters student-visible snapshot. Publish checks approval and classroom visibility. Student media endpoint verifies membership + published assignment on every URL issuance. No teacher avatar management APIs accessible to students.
7. Deterministic mock video job: resolve an actual private demo-library item, pin script/avatar versions, queue on existing worker. No configured demo => safe failure, not fake playable success. Demo label must follow media provenance, including student-facing content disclosure without provider controls.
8. Web E2E using isolated test fixtures: teacher upload → preview → approve/attach → publish → separate student playback, seek/range tests, cross-tenant denial and URL expiration. Keep paid providers disabled.
9. Only after web acceptance: Expo/React Native app using same API contracts. SecureStore auth, teacher/student navigation, native image-picker/crop and document/video selection, expo-video playback. No second backend. Shared media DTOs, mobile-specific screens/bottom sheets. Test Android/iOS authentication, upload interruption, private playback and orientation.

## Non-negotiable gates
No Anthropic or paid video calls. No staging generation or new classroom/pack data during implementation. Never use service-role credentials in clients. Do not deploy migration before review. Required regression: backend, TS, production web build, authorization suite, browser media test, mobile build/tests and secret/bundle scans.

## Current scope
Provider contract and route-bound script Studio are the first implementation slice. Avatar/video persistence, private media delivery, student playback and Expo remain pending until their security and storage prerequisites are implemented. This document is not a full-product PASS claim.
