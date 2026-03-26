# AgentVault Deployment Notes

## Required Runtime Environment Variables

- `CIRCLE_API_KEY`
- `CIRCLE_ENTITY_SECRET`
- `CIRCLE_APP_ID`
- `DATABASE_URL` (preferred) or `POSTGRES_URL`

## Build Warnings Clarification

- `npm WARN ERESOLVE overriding peer dependency` around `use-sync-external-store` is a peer warning from transitive deps and does not fail deployment by itself.
- Only treat deployment as failed if `next build` exits non-zero or runtime requests fail.

## Strict Live Smoke Test

1. Run `npm run smoke:live -- https://agentvault-ecru.vercel.app` and require all checks to return `PASS`.
2. Run `BASE_URL=https://agentvault-ecru.vercel.app npm run smoke:e2e:live` and require:
   - `public APIs are reachable` = pass
   - `protected APIs reject unauthenticated requests` = pass
   - `wallet auth can retrieve actor-scoped audit logs` = pass or skipped only when no test wallet env vars are set
3. In browser, connect wallet and authenticate once. Confirm auth button shows `Wallet Authenticated` and remains disabled.
4. Post one task from `/tasks` and confirm `Task posted successfully!` plus new task visible on refresh.
5. Assign that task to an agent and verify state transitions in order:
   - `open` -> `assigned`
   - `assigned` -> `in_progress`
   - `in_progress` -> `completed`
   - `completed` -> `paid`
6. From the same authenticated browser session, open `/api/audit-logs?limit=20` and confirm HTTP 200 with JSON `logs` array.
7. Trigger rate limiting on a protected endpoint and confirm HTTP `429` with `Retry-After` header.

## Notes

- Task persistence is Postgres-backed.
- Rate limiting, audit logs, and auth nonce/session stores are in-memory by design.
