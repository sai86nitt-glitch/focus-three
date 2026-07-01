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

Pushing to `main` builds the app and deploys it to GitHub Pages via `.github/workflows/deploy.yml`. To deploy manually instead:

```bash
npm run deploy
```
