# Deployment

This release is a static browser application. GitHub Pages is suitable for the front end.

1. In the repository, open **Settings → Pages**.
2. Choose **GitHub Actions** as the deployment source.
3. The quality workflow runs Node.js tests and static smoke checks on branch pushes and pull requests.
4. The Pages workflow packages both `index.html` and `js/` before deploying.
5. Push reviewed changes to `main` or manually run the Pages workflow.
6. The public Pages URL is shown in the workflow summary and **Settings → Pages**.

No wallet secrets or environment variables are required. Do not deploy secrets to Pages. This front end is paper-only; deploying it does not enable live trading.
