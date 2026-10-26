# Focus Three

A task manager that only ever shows you three tasks. Every task requires a target date; the three with the soonest dates are your "focus," everything else waits in the backlog until you clear space by finishing or rescheduling.

Built with React, TypeScript, Vite, and Tailwind. Data is stored in `localStorage` — no backend. Installable as a PWA (Add to Home Screen on iOS/Android).

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy

Pushing to `claude/new-session-woemhk` (the repo's default branch for now) builds the app and deploys it to GitHub Pages via `.github/workflows/deploy.yml`. Update that workflow's `branches` list if the deploy branch changes. To deploy manually instead:

```bash
npm run deploy
```

## Daily reminders (optional)

The app can send one push notification a day listing your focus tasks. It needs the small server in `server/` running somewhere public (Render, Fly.io, a VPS, etc.). On iPhone, reminders work only after you add the app to your Home Screen (iOS 16.4+).

1. In `server/`, run `npm install`, then `npm run keys`. Save the two printed values.
2. Start the server with `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:` address), and optionally `ALLOWED_ORIGIN` (your Pages origin) and `PORT`: `npm start`.
3. Copy `.env.example` to `.env.local` and set `VITE_PUSH_SERVER_URL` to the server's public URL. Rebuild and redeploy the app.
4. In the app, tap "Turn on daily reminder."

Reminders go out at 8:00 local time. Task titles and dates are stored on the server so it can send them; anyone who can reach the server's `/subscribe` endpoint can add a device, so keep the server private to you if you can.
