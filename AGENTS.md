<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Secret Safety Rules

- Never print raw contents of `.env`, `.env.local`, `.env.*`, or private key files.
- If asked to show env config, return redacted values only (e.g. `API_KEY=***`).
- Never echo token, API key, private key, entity secret, or wallet secret values in terminal output summaries.
