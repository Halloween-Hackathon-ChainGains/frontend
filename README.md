# Loop

**Kidney exchange for everything else.** People say what they have and what they want, and Loop finds trade cycles ("loops") where everyone gets something.

**Live:** https://loop-bot-town.vercel.app

## What's in the app

One page with three tabs:

- **Town:** the projector view. Every person is a bot walking around a little night-time campus. Bots chat about possible trades, and when a loop is found they meet in the plaza, form a glowing ring, and say their trades out loud. The sidebar shows the QR code to join, live totals and every deal found.
- **Join:** tell your bot what you have and what you need. It walks into town, chats with other bots, finds a loop, and proposes a meetup for you to approve (with an Add to calendar file).
- **Admin:** controls (fit town, pixel art, reset), totals, everyone in town, and every loop.

`/join` (where the QR code points) opens the same app on the Join tab.

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Other scripts: `npm run build`, `npm run typecheck`, `npm run lint`.

## Backend and simulated data

The frontend reads from:

- `GET /api/loops`: people, possible trades, loops and stats (polled every 2 seconds)
- `POST /api/people`: join with `{ name, have, want }`, returns the new person's id
- `POST /api/reset`: clear the town (Admin tab)

Until those routes exist (or whenever they return 404/405/5xx), a built-in simulator stands in so the town is never empty. It switches to real data on its own once the backend responds. Add `?mock=1` to force the simulator.

All parsing of backend responses lives in `components/data/adapt.ts`, which is the one place to update if field names differ.

Meetup approvals are stored in the browser for now; the backend will need endpoints to propose a meetup and record each person's response.

## Environment variables

Upstash for Redis is connected to the Vercel project. It provides:

- `KV_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`
- `REDIS_URL`

To pull them locally (requires access to the Vercel project):

```bash
vercel link
vercel env pull .env.local
```

## Stack

Next.js, React, `react-force-graph-2d` for the town, `motion` for springs and gestures, `qrcode.react`, `@number-flow/react`, and `lucide-react` icons. Bots and the town are drawn in code (SVG and canvas), with no image assets.
