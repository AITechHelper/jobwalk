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
- OpenAI Whisper — timestamped transcription
- Claude (Sonnet) — report generation (text-only; photos matched by timestamp)
- Vercel Blob — photo/audio/PDF storage
- Vercel — hosting and deploys

## Development

```bash
cp .env.example .env.local   # fill in keys
npm install
npm run dev
```

Brand colors: `#0a0f1e` navy · `#0066ff` electric blue · `#3385ff` light blue
(Tailwind tokens: `navy`, `brand`, `brand-light`).
