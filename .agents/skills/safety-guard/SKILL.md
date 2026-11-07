---
name: safety-guard
description: Prevent destructive changes and unauthorized production deployment.
---
# Safety Guard
Reference: https://github.com/garrytan/gstack (/careful, /freeze, /guard concepts).
No force push, branch deletion, credential output, secret commits, destructive filesystem/database commands, direct production writes or auto-merge. Limit changes to approved paths and stop for explicit confirmation before risky operations. These are guidance rules; no executable enforcement hook is installed.
