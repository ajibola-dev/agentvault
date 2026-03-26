# AgentVault Deployment Notes

## Required Runtime Environment Variables

- `CIRCLE_API_KEY`
- `CIRCLE_ENTITY_SECRET`
- `CIRCLE_APP_ID`
- `DATABASE_URL` (preferred) or `POSTGRES_URL`

## Build Warnings Clarification

- `npm WARN ERESOLVE overriding peer dependency` around `use-sync-external-store` is a peer warning from transitive deps and does not fail deployment by itself.
- Only treat deployment as failed if `next build` exits non-zero or runtime requests fail.

## Post-Deploy Smoke Test

1. Open `/api/get-tasks` and confirm JSON response shape includes `tasks`.
2. Run wallet auth flow in app (nonce + verify) and confirm session is set.
3. Post a new task from UI and confirm it appears in task list after refresh.
4. Assign the task and confirm status transitions:
   - `open` -> `assigned`
   - `assigned` -> `in_progress`
   - `in_progress` -> `completed`
   - `completed` -> `paid`
5. Confirm rate limiting still responds with `429` after repeated calls to protected endpoints.

## Notes

- Task persistence is Postgres-backed.
- Rate limiting, audit logs, and auth nonce/session stores are in-memory by design.
