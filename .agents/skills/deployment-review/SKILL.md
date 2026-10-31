---
name: deployment-review
description: Review Cloudflare preview and deployment readiness.
---
# Deployment Review
Custom Qingyu workflow.
Require green Python unit tests, syntax check, data schema validation, mobile/desktop QA evidence, PR diff review and verified Cloudflare preview. Confirm preview visibility and secrets handling. Never merge or deploy to production without a separate explicit user approval. Existing scheduled stock data workflow must continue functioning. If Cloudflare preview integration is unavailable, report blocked rather than claiming a preview exists.
