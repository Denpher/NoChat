# Migrations

| File | Kind | What it does |
|---|---|---|
| `../schema.sql` | already applied (v3.0) | Original tables and functions. Do not re-run. |
| `2026-11-13-v3.3-videos.sql` | additive | Lets `nochat_save` accept the `videos` collection. Nothing is dropped or deleted. |

How to apply: open the Lovable project that hosts the NoChat Cloud bridge and ask it to run
`2026-11-13-v3.3-videos.sql` as a migration, or paste it into that project's SQL migration tool.

Until it is applied, NoChat v3.3 still starts and every existing feature works; the server logs a
warning, the preloaded videos remain watchable, but view counts and founder video management answer
`503 VIDEO_SCHEMA_MISSING` instead of pretending to save. Nothing is lost.

If the bridge code itself also checks collection names (outside SQL), add `videos` to that list too.
