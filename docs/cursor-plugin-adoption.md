# Cursor plugin adoption — security-gated proposal

Status: **NOT INSTALLED OR ENABLED**. This branch records reviewed integration requirements; it does not install remote MCP servers or npm packages.

Upstream: https://github.com/cursor/plugins

| Plugin | Upstream path | License (plugin) | Integration | Blocker |
|---|---|---|---|---|
| GitHub | third_party/github | MIT | Remote MCP with GitHub PAT | Fine-grained token permissions and remote MCP tool inventory not verified |
| Playwright | third_party/playwright | MIT | MCP: npx -y @playwright/mcp@latest | Floating dependency; lock version, check npm integrity/transitive dependencies, isolate browser |
| Thermos | thermos | MIT | Cursor skills and subagents | Review-only usage; verify all agents, prevent automated merge/deploy |
| Agent Compatibility | agent-compatibility | MIT | Cursor skills and subagents, npm scanner | Floating agent-compatibility@latest; verify dependencies and YAML compatibility |

## Security acceptance criteria

1. Pin the exact upstream plugin commit SHA and npm dependency versions, and verify their integrity, licenses and vulnerability reports before installing.
2. Never commit GitHub PAT, Cloudflare tokens, cookies or .env files. GitHub MCP must use a fine-grained token scoped to this repository with read-only access for initial evaluation.
3. For Playwright use an isolated, disposable browser context against a non-production preview with no real credentials.
4. Thermos must only produce review findings. No take-the-wheel, FSD, auto-merge or production deployment workflows.
5. Agent Compatibility scanner must be run only after the published npm artifact and transitive dependencies are audited. A readonly agent declaration is not OS-level sandboxing.
6. Validate the real CI workflows, branch protection and Cloudflare automatic production deployment triggers before any merge.
7. Record test commands and outputs; do not claim an unrun test passed.

## Project-specific baseline

- Static HTML/CSS/JavaScript, Python 3.10+ TWSE/TPEx ingestion, JSON data snapshots.
- Node 22+ tests; Cloudflare Workers static assets built via `python3 scripts/build_static.py`.
- Existing validation commands documented in README: `python -m unittest discover -s tests -v`, `node --test tests/*.test.mjs`, `python scripts/audit_coverage.py`.
- No production merge or deployment is authorized by this document.

## Remaining work

- Inspect all exact upstream source paths and subagent instructions at a pinned commit.
- Verify npm package tarballs, dependency trees, licenses, vulnerabilities and install lifecycle scripts.
- Inspect actual GitHub Actions files, branch rules, and Cloudflare Builds settings.
- Run isolated tests; then submit separate explicit approval request before enabling any of the four plugins.
