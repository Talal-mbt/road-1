# Deployment

This release is a standalone static page; GitHub Pages is suitable for the frontend.

1. In the repository, open Settings → Pages.
2. Choose GitHub Actions as the source.
3. The workflow `.github/workflows/pages.yml` deploys repository contents on push to `main` or via manual workflow dispatch.
4. The Pages URL appears in the workflow run summary and Settings → Pages.

No wallet secrets or environment variables are required. Do not deploy secrets to Pages.
