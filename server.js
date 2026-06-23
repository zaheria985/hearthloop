const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// CONFIG_DIR is where the live, writable config.json lives. In Docker this is a
// mounted volume (default /config) so settings survive container re-creation.
// Locally it defaults to the app directory.
const CONFIG_DIR = process.env.CONFIG_DIR || __dirname;
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const EXAMPLE_PATH = path.join(__dirname, 'config.example.json');

// ── Config loading ─────────────────────────────────────────
// All personal settings live in config.json (gitignored). If it's
// missing we fall back to config.example.json so the app still boots.
function loadConfig() {
  for (const p of [CONFIG_PATH, EXAMPLE_PATH]) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) { /* try next */ }
  }
  console.error('No config.json or config.example.json found — using empty config.');
  return {};
}

let config = loadConfig();
const imm = () => config.immich || {};
const wx  = () => config.weather || {};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Weather proxy ──────────────────────────────────────────
app.get('/proxy/weather', async (req, res) => {
  try {
    const w = wx();
    const params = new URLSearchParams({
      latitude: w.latitude,
      longitude: w.longitude,
      current: 'temperature_2m,weathercode',
      daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      hourly: 'temperature_2m,precipitation_probability,weathercode',
      temperature_unit: w.temperatureUnit || 'fahrenheit',
      wind_speed_unit: w.windSpeedUnit || 'mph',
      timezone: w.timezone || 'auto',
      forecast_days: '6',
    });
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    res.json(await r.json());
  } catch (e) {
    console.error('Weather proxy error:', e);
    res.status(500).json({ error: 'weather fetch failed' });
  }
});

// Resolve the configured calendar feeds — supports an `icalUrls` array and
// falls back to the legacy single `icalUrl` string.
function icalUrls() {
  const c = config.calendar || {};
  if (Array.isArray(c.icalUrls)) return c.icalUrls.filter(Boolean);
  if (c.icalUrl) return [c.icalUrl];
  return [];
}

// ── iCal proxy ────────────────────────────────────────────
// Fetches every configured feed and concatenates them. The client parser walks
// all VEVENT blocks regardless of file boundaries, so merged feeds Just Work.
// One failing feed is skipped rather than breaking the rest.
app.get('/proxy/ical', async (req, res) => {
  try {
    const urls = icalUrls();
    if (!urls.length) return res.status(500).send('no ical url configured');
    const texts = await Promise.all(urls.map(async (u) => {
      try {
        const r = await fetch(u);
        return await r.text();
      } catch (e) {
        console.error('iCal fetch error for', u, e);
        return '';
      }
    }));
    res.set('Content-Type', 'text/calendar');
    res.send(texts.join('\n'));
  } catch (e) {
    console.error('iCal proxy error:', e);
    res.status(500).send('ical fetch failed');
  }
});

// ── Immich proxy — albums list ────────────────────────────
app.get('/proxy/immich/albums', async (req, res) => {
  try {
    const r = await fetch(`${imm().base}/api/albums`, {
      headers: { 'x-api-key': imm().apiKey },
    });
    res.json(await r.json());
  } catch (e) {
    console.error('Immich albums error:', e);
    res.status(500).json({ error: 'immich albums failed' });
  }
});

// ── Immich proxy — single album ───────────────────────────
app.get('/proxy/immich/albums/:id', async (req, res) => {
  try {
    const r = await fetch(`${imm().base}/api/albums/${req.params.id}`, {
      headers: { 'x-api-key': imm().apiKey },
    });
    res.json(await r.json());
  } catch (e) {
    console.error('Immich album error:', e);
    res.status(500).json({ error: 'immich album failed' });
  }
});

// ── Immich proxy — thumbnail ──────────────────────────────
app.get('/proxy/immich/thumbnail/:id', async (req, res) => {
  try {
    const size = req.query.size || 'preview';
    const r = await fetch(`${imm().base}/api/assets/${req.params.id}/thumbnail?size=${size}`, {
      headers: { 'x-api-key': imm().apiKey },
    });
    res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    r.body.pipe(res);
  } catch (e) {
    console.error('Immich thumbnail error:', e);
    res.status(500).send('thumbnail failed');
  }
});

// ── Config API (for the settings page + the display) ──────
// Non-secret values the dashboard frontend needs at load time.
app.get('/api/client-config', (req, res) => {
  res.json({
    immichAlbumName: imm().albumName || '',
    ...(config.display || {}),
  });
});

// Full config, used by the /settings editor.
app.get('/api/config', (req, res) => res.json(config));

// Persist edited config from the settings page.
app.post('/api/config', (req, res) => {
  try {
    const incoming = req.body || {};
    if (typeof incoming !== 'object' || Array.isArray(incoming)) {
      return res.status(400).json({ error: 'invalid config' });
    }
    config = incoming;
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    res.json({ ok: true });
  } catch (e) {
    console.error('Save config error:', e);
    res.status(500).json({ error: 'save failed' });
  }
});

app.listen(PORT, () => {
  console.log(`HearthLoop server running on port ${PORT}`);
});
