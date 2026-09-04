<p align="center">
	<img src="assets/readme_logo.png" alt="ryuu. logo" width="900">
</p>

<h1 align="center">ryuu.</h1>

<p align="center">
	A clean anime discovery and streaming front-end powered by AniList.
</p>

<p align="center">
	<a href="https://github.com/az4if/ryuu.">Repository</a>
	·
	<a href="https://graphql.anilist.co">AniList API</a>
</p>

## What is Ryuu?

Ryuu is a lightweight anime browser built with plain HTML, CSS, and JavaScript. It has no build step and works as a static site.

## Features

- Browse trending, seasonal, popular, and airing anime.
- Search the AniList catalog.
- View title details, trailers, episodes, and streaming sources.
- Track anime status and episode progress with AniList.
- Install it as a Progressive Web App.
- Cache the app shell for fast repeat loads and basic offline support.
- Responsive layout for desktop and mobile.

## Run locally

Because Ryuu uses browser APIs and a service worker, serve it over a local HTTP server instead of opening `index.html` directly.

```bash
python -m http.server 8000
```

Open <http://localhost:8000> in your browser.

## Deploy to GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `main`, or run the deployment workflow from the **Actions** tab.

The site uses relative asset paths, so it works at both a domain root and a GitHub Pages project path. The included `.nojekyll` file keeps GitHub Pages from processing the site with Jekyll.

## Configuration

- `key.js` contains the public AniList client configuration. Do not add a client secret to this file.
- `site-picks.js` controls the anime shown in the Site Picks slideshow.
- `sw.js` contains the app-shell cache. Bump `CACHE_VERSION` whenever a cached HTML, CSS, JavaScript, or icon file changes.

## Project structure

```text
index.html          App shell
app.js              Core application logic
overrides.js        UI enhancements and playback integrations
style.css           Base styles
enhancements.css    Additional responsive styling
site-picks.js       Site Picks configuration
sw.js               Service worker and offline cache
assets/             Logos and artwork
favicons/           Browser and device icons
```

## Notes

AniList supplies the anime metadata. Video providers and live API data require an internet connection. AniList OAuth is optional and is only needed for account-based progress tracking.

## License

See [LICENSE](LICENSE) for the project license.

## Inspiration

Ryuu is inspired by [Zenshin](https://github.com/hitarth-gg/zenshin), a web and Electron-based anime streaming app by [hitarth-gg](https://github.com/hitarth-gg). This project builds on that inspiration with its own interface, styling, and implementation.
