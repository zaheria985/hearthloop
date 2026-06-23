# HearthLoop

A self-hosted wall-display dashboard — a local, DAKboard-inspired panel that
loops through your home's day. It alternates between an **info screen** (clock, month calendar,
weather, and an upcoming-events agenda) and a **photo slideshow** pulled from an
[Immich](https://immich.app) album. A small Express server proxies the weather,
calendar, and photo requests so your API keys stay server-side.

## Quick start (Docker Compose)

```bash
docker compose up -d --build
```

This builds the image, starts it on port `3000`, and mounts `./data` to `/config`
so your settings persist across rebuilds.

Open the dashboard at <http://localhost:3000> and the settings editor at
<http://localhost:3000/settings.html>. On first run the app boots with the
placeholder values from `config.example.json` — open the settings page, fill in
your details, and Save. That writes `config.json` into the mounted `/config`
volume.

### Run with the prebuilt image

Pushes to `main` publish an image to GHCR via GitHub Actions. To use it instead
of building locally, set `image:` in `docker-compose.yml` to
`ghcr.io/zaheria985/hearthloop:latest` and drop the `build:` line, then
`docker compose pull && docker compose up -d`.

## Quick start (local Node, no Docker)

```bash
npm install
cp config.example.json config.json   # then edit, or use the settings page
npm start
```

## Configuration

All personal settings live in **`config.json`**, which is **gitignored** — it is
never committed. `config.example.json` is the template.

You can edit settings two ways:

- **Settings page** (recommended): open `/settings.html` in a browser, change
  values, and click **Save**. Photo / calendar / weather changes take effect on
  the next data refresh; display-timing changes apply when the dashboard reloads.
- **By hand**: edit `config.json` directly.

| Section    | Key                | Meaning                                            |
|------------|--------------------|----------------------------------------------------|
| `immich`   | `base`             | Immich server base URL                             |
|            | `apiKey`           | Immich API key (server-side only)                  |
|            | `albumName`        | Album to show as the slideshow                     |
| `calendar` | `icalUrls`         | Array of published iCal (`.ics`) feed URLs; all events are merged into the agenda |
| `weather`  | `latitude`/`longitude` | Location for the [Open-Meteo](https://open-meteo.com) forecast |
|            | `temperatureUnit`  | `fahrenheit` or `celsius`                          |
|            | `windSpeedUnit`    | `mph`, `kmh`, `ms`, or `kn`                        |
|            | `timezone`         | IANA timezone, e.g. `America/Chicago`              |
| `display`  | `infoDuration`     | ms to show the info screen before the slideshow    |
|            | `slideshowDuration`| ms to run the slideshow before returning to info   |
|            | `slideInterval`    | ms per photo in the slideshow                      |
|            | `bgChangeInterval` | ms between background swaps on the info screen      |

(The settings page shows the `display` values in **seconds** for convenience and
converts to milliseconds on save.)

## Environment variables

| Var          | Default     | Meaning                                          |
|--------------|-------------|--------------------------------------------------|
| `PORT`       | `3000`      | Port the server listens on.                      |
| `CONFIG_DIR` | app dir     | Directory holding the live `config.json`. Set to `/config` in Docker so settings persist on a mounted volume. |

## Running as a service (bare metal)

If you'd rather not use Docker, `hearthloop.service` is a sample systemd unit.
Adjust `WorkingDirectory` / `ExecStart` to wherever you deploy, then:

```bash
sudo cp hearthloop.service /etc/systemd/system/
sudo systemctl enable --now hearthloop
```

## Layout

- `server.js` — Express server: serves the UI and proxies weather / iCal / Immich.
- `public/index.html` — the dashboard display.
- `public/settings.html` — the settings editor.
- `config.json` — your settings (gitignored; lives in `CONFIG_DIR`).
- `config.example.json` — template the app falls back to on first run.
- `Dockerfile` / `docker-compose.yml` — container build + run.
