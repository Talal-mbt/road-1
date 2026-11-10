# Deployment and phone installation

This version is a static PWA. It needs an HTTPS origin for service-worker installation.

1. Open repository **Settings → Pages**.
2. Choose **GitHub Actions** as the deployment source. This setting must be enabled by a repository owner in GitHub; the GitHub Actions connector cannot enable Pages for this repository.
3. Push reviewed code to `main` or manually run the Pages workflow.
4. The workflow packages `index.html`, `manifest.webmanifest`, `service-worker.js`, `js/`, and `assets/`.
5. Open the resulting HTTPS Pages URL in Chrome on Android.
6. Select **Install app** or Chrome menu → **Add to Home screen**.

If GitHub Pages is unavailable for this private repository/plan, use another HTTPS static host for these files. No server credentials or API secrets are required for the reference-data / paper-only mode.

## Runtime limitations

The PWA performs polling only while visible. When it is hidden, it pauses and resumes after returning to foreground. The service worker caches static shell files only. It does not run a perpetual loop in the background and does not execute real trades.
