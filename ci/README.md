# CI configuration

`github-actions-ci.yml` runs typecheck → lint → test → build on every push
and pull request.

It lives here rather than in `.github/workflows/` because the GitHub App used
to push this branch doesn't hold the `workflows` permission. To activate it:

```bash
mkdir -p .github/workflows
git mv ci/github-actions-ci.yml .github/workflows/ci.yml
git commit -m "ci: enable GitHub Actions workflow"
git push
```
