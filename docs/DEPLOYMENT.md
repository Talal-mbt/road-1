# ROAD — Deployment and Android installation

ROAD is deployed as a static PWA through GitHub Pages and requires an HTTPS origin for service-worker installation.

## Current repository and URL

- Repository: https://github.com/Talal-mbt/road-1
- GitHub Pages: https://talal-mbt.github.io/road-1/
- Default branch: `main`
- Pages workflow: `.github/workflows/pages.yml`

## Deployment

1. Open the repository **Settings → Pages**.
2. Select **GitHub Actions** as the deployment source.
3. Push reviewed changes to `main` or run the Pages workflow manually.
4. The workflow packages `index.html`, `manifest.webmanifest`, `service-worker.js`, `js/` and `assets/`.
5. Confirm the latest workflow run completes the `Deploy pages` step.
6. Open the Pages URL above and check the installed app name and icon.

GitHub Pages content is publicly accessible. Do not place trading credentials, API secrets, private account data or personal data in this static repository or deployment artifact.

## Install on Android

1. Open https://talal-mbt.github.io/road-1/ in Chrome.
2. Choose **Install app** or Chrome menu → **Add to Home screen**.
3. Launch ROAD from the home screen.
4. If an older version is cached, close the installed app fully and reopen it after the new deployment. The service-worker cache namespace is versioned so the next worker install replaces the previous app-shell cache.

## Offline behavior

The service worker caches only same-origin app-shell files. The app remains open and can display cached UI while offline, but live prices and provider data are unavailable until the network returns. Offline display must never be interpreted as a live quote.

## Operational limitations

This PWA performs polling only while the page is visible. Android may suspend a background page. The service worker does not run continuous trading logic and does not execute MT5 Expert Advisors.
