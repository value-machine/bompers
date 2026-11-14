# Security Standards

Standard secure-coding practice applies (parameterized queries, output escaping, least privilege, input validation at boundaries, no secrets or PII in logs). This rule covers what is specific to this repo.

## Authorization

- If a backend is ever added, enforce authorization on the server. Client-side checks are UX only — never trust them.

## Secrets

- `VITE_*` variables are compiled into the browser bundle: only publishable values. Server secrets live in Cloudflare settings — catalog: `.claude/rules/platform.md`.
- Never commit secrets; `.env` is gitignored, `.env.example` holds placeholders only.
- There may be env files you can't see — respect their restrictions.
