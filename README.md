# JobWalk

Turn your job walk into a client-ready report.

Free mobile app for trades contractors (roofing, HVAC, construction). Walk the
job site, narrate what you see, snap photos — JobWalk transcribes the audio,
matches each photo to what you were saying when you took it, and generates a
clean, professional report you can send to clients or coworkers.

Built by [AI Tech Helper LLC](https://aitechhelper.com), Tulsa, OK.

## Stack

- Next.js (App Router) + React + Tailwind — web app and API
- Capacitor — iOS/Android shell (camera + mic); API routes stay on Vercel
- Clerk — auth
- Neon Postgres — database
- OpenAI Whisper — timestamped transcription + voice-to-text notes
- Claude (Sonnet) — report generation (text-only; photos matched by timestamp)
- Vercel Blob — photo/audio/PDF/plan storage
- pdf.js — in-app plan rendering for takeoff measurements
- Open-Meteo + NWS + US Census geocoder — automated daily-report weather (no keys)
- Vercel — hosting and deploys

## Features

**Walkthrough reports** — record a job walk, narrate, snap photos; get a
client-ready report (the original flow).

**Daily report system** — Clients → Projects → Rooms/Areas hierarchy with
role-based access (owner/foreman edit; GC/client view-only). Each daily report
has a commercial/residential toggle, a workforce table with crew and activity
dropdowns and auto-calculated hours, optional equipment, Health &
Safety / Visitors / Deliveries events, area-grouped photos, observations with
voice-to-text, and threaded GC/client comments. Weather is pulled automatically
from the project's geocoded address for the report date (historical for
backdated reports, forecast for same-day) so rain delays are documented with no
manual entry.

**Plan takeoff** — upload a plan (PDF or image), pick an architectural scale
from the dropdown, then trace walls/segments with pinch-to-zoom and pan on web
or mobile. Each trace is converted to a real-world measurement and stored per
plan. No calibration clicks — manual scale select + manual trace.

## Development

```bash
cp .env.example .env.local   # fill in keys
npm install
npm run dev
```

Brand palette: black background · white text · `#0a0f1e` navy surfaces ·
`#3385ff` blue accent (Tailwind tokens: `background`, `foreground`, `navy`,
`brand`; muted text is white at reduced opacity, e.g. `text-white/60`).
