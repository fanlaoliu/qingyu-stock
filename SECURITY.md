# Secret handling for Qingyu Stock

- Never commit passwords, API keys, access tokens, private keys, signing certificates, or local .env files.
- Store deployment credentials in GitHub Actions Secrets or Cloudflare encrypted secrets; never in the repository.
- The .env.example file contains placeholders only.
- A .gitignore rule does not protect files already tracked by Git or secrets in past commits.
- The secret-scan workflow checks the current tracked source tree on pull requests and pushes to main. It does **not** certify historical commits or remote deployment settings.
- For suspected exposure: revoke or rotate the credential immediately, investigate Git history and Actions logs, remove tracked files safely, and assess whether history rewriting is necessary. History rewriting alone does not invalidate exposed credentials.
- Review any secret scanner findings; false positives are possible. Do not paste actual secret values into issues, PR comments, or logs.
- To perform a comprehensive audit, separately scan all branches and full Git history using an approved secret scanner with appropriate repository access.
