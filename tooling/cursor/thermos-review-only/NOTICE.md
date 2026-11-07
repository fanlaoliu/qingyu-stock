# Provenance and changes

This is a Qingyu-specific derivative of the review ideas in cursor/plugins Thermos.
It is not the upstream Thermos plugin and is not endorsed by Cursor.

Pinned upstream: https://github.com/cursor/plugins/tree/ae5650febf4320793844c12c4adaa937f417f8da/thermos

Original MIT copyright and license are retained in LICENSE.
The manifest, names and review instructions have been replaced for a narrower scope:
two manually selected read-only agents, supplied excerpts only, findings in chat only,
no shell execution, nested orchestration, automatic repair, PR writes or deployment.
No upstream Skill is auto-discovered; no MCP or npm dependency is included.
No model is forced, to avoid an implicit model selection or additional paid service.

The readonly field and instructions express policy, not an operating-system sandbox.
This artifact has passed static/package tests only. Cursor discovery, client enforcement,
agent execution and prompt-injection resistance require a separate no-secret client test.
Do not symlink or copy it into an active plugin directory before those checks pass.
