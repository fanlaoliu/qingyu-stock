# Agent Skills adoption record

Date: 2026-10-31. Scope: branch-only; production untouched.

| Requested | Result | Notes |
| --- | --- | --- |
| Code Review (gstack) | Project adapter added | Upstream executable not installed |
| Browser QA (gstack) | Project adapter added | Browser execution not yet verified |
| Frontend Design (Anthropic) | Project adapter added | Adapted for static HTML/CSS/JS |
| React Best Practices (Vercel) | Reference only | React not present |
| Safety Guard (gstack) | Project rules added | No enforcement hooks installed |
| Find Skills (Vercel) | Discovery workflow added | CLI not installed |
| Deployment Review (custom) | Project skill added | Cloudflare preview not verified |

Sources: https://github.com/garrytan/gstack ; https://github.com/anthropics/skills ; https://github.com/vercel-labs/agent-skills ; https://github.com/vercel-labs/skills

License check: gstack and Vercel repositories describe MIT licensing; verify each upstream skill's license and exact revision before copying or executing its implementation. These files are original project adaptations and link to upstream references, not verbatim vendor distributions.

Existing workflow .github/workflows/update-data.yml remains unchanged. This PR does not configure Cloudflare deployment or GitHub branch protection.
