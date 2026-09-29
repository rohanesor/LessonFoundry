# Migration 008 RLS Review

**Status:** reviewed locally; **not applied** to any hosted database.

Migration `008_classroom_rls.sql` is an additive migration for the classroom
entities introduced in migrations 004–007. It enables/forces RLS and adds
indexes only; it does not drop, truncate, or reset tables.

| Table / scope | Role | Permissions | Policy purpose |
|---|---|---|---|
| `classrooms` | `lessonfoundry_api` | Owner: SELECT/INSERT/UPDATE/DELETE; member: SELECT only | Teachers manage only owned classrooms; active students may see their own classroom. |
| `classroom_members` | `lessonfoundry_api` | Student: SELECT self, INSERT self into active class; owner: SELECT/UPDATE/DELETE roster | Prevents a student from reading other student records or modifying membership. |
| `units` | `lessonfoundry_api` | SELECT only for active classroom members and only when published | Existing owner policy retains teacher draft access. |
| `assets`, `asset_versions` | `lessonfoundry_api` | SELECT only for approved, published versions in an enrolled class | Prevents draft/version-management leakage. |
| `resources` | `lessonfoundry_api` | SELECT only for approved resources in an enrolled, published class | Matches student learning view. |
| `exports` | `lessonfoundry_api` | SELECT only for completed exports in an enrolled, published class | Allows the API to mint a download URL only after authorization. |
| `users` | `lessonfoundry_api` | SELECT self, teacher display profile for members, roster profiles for owner | Supports dashboards without cross-classroom user visibility. |
| all affected tables | `lessonfoundry_worker` | SELECT/INSERT/UPDATE/DELETE | Intentionally retained for the isolated worker role; never browser access. |

`lf_private` SECURITY DEFINER helper functions are used solely to avoid
recursive RLS evaluation between classrooms and memberships. They are revoked
from `PUBLIC`, `anon`, and `authenticated`, and executable only by
`lessonfoundry_api`. The migration administrator owns these functions and must
remain a restricted migration role.

## Before hosted application

1. Review this document with the Supabase/database administrator.
2. Apply migrations in order: 001–008, including 002 security migration.
3. Verify table ownership, role memberships, RLS policies, and query behavior
   using separate teacher/student identities.
4. Do not apply with a browser anon/authenticated role or a superuser API login.
