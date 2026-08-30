# Ryuu 龍

A premium anime browsing/streaming front-end, built as a static site (plain HTML/CSS/JS, no build step) pulling trending data from AniList.

## Deploying to GitHub Pages

This repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that deploys automatically on every push to `main`.

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Push to `main` (or run the workflow manually from the **Actions** tab) — the site will build and publish at `https://<username>.github.io/<repo-name>/`.

All asset paths in the project are relative, so the site works correctly whether it's hosted at a domain root or under a Pages project subpath. A `.nojekyll` file is included so Pages serves the files as-is instead of running them through Jekyll.

## PWA support

The site is a fully installable Progressive Web App:

- `site.webmanifest` — app name, theme colors, and icon set (192px/512px, including maskable variants).
- `sw.js` — a service worker that caches the app shell (HTML/CSS/JS/icons) for fast repeat loads and basic offline tolerance. Live data (AniList API) and the video player are network-only and are never cached.
- An **Install App** button appears in the header automatically once the browser determines the app is installable (via the `beforeinstallprompt` event).
- Full favicon/touch-icon/tile coverage lives in `favicons/` and is linked from `index.html` for browsers, iOS home-screen icons, Android/Chrome, and Windows tiles (`browserconfig.xml`).

### Notes
- Bump `CACHE_VERSION` at the top of `sw.js` whenever you change `index.html`, `style.css`, or `app.js`, so returning visitors get the update instead of a stale cached copy.
- Since GitHub Pages serves over HTTPS, service workers and installability work out of the box with no extra configuration.
