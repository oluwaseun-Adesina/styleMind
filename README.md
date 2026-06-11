# FitPick

Your personal AI stylist. FitPick keeps track of your wardrobe and suggests complete outfits — tuned to the occasion, the weather, the season, and what you've worn recently — then generates a flat-lay image of the look using only clothes you actually own.

## Features

- **Wardrobe management** — add items manually or snap a photo and let AI identify each garment (name, color, type, formality, and a material description used for image matching). Items can be edited any time.
- **Outfit suggestions** — daily auto-picks and on-demand looks for any occasion, weather- and season-aware, with up to 3 alternative looks to compare. Lock an item to build the outfit around it.
- **Outfit images** — generate an editorial flat-lay of a suggested look, faithful to the real garments' colors and materials.
- **Lookbook** — save favorite outfits, mark them as worn, and get variety in future suggestions.
- **Events** — plan upcoming occasions and get styled for them.
- **Accounts** — email/password and Google sign-in, password reset via emailed code, and in-app account settings.

## Monorepo layout

| Path | Description |
| --- | --- |
| [`apps/web`](apps/web) | React + Vite + Tailwind web app |
| [`apps/mobile`](apps/mobile) | React Native (Expo) mobile app |
| [`backend`](backend) | Express + MongoDB API (Gemini for AI features) |
| [`shared`](shared) | Types shared by all workspaces |

## Run locally

**Prerequisites:** Node.js 20+, a MongoDB instance, and a Gemini API key.

1. Install dependencies:
   ```sh
   npm install
   npm --prefix backend install
   npm --prefix apps/mobile install   # only if working on mobile
   ```
2. Configure the backend — copy [`backend/.env.example`](backend/.env.example) to `backend/.env` and fill in at least `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, and `GOOGLE_CLIENT_ID`. Optional: `OPENWEATHER_API_KEY` (weather-aware picks), `RESEND_API_KEY` + `EMAIL_FROM` (password-reset emails; codes are logged to the console without it), `HF_TOKEN` (image-generation fallback).
3. Configure the web app — copy [`apps/web/.env.example`](apps/web/.env.example) to `apps/web/.env` (`VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`).
4. Start the backend:
   ```sh
   npm run dev:backend
   ```
5. In a second terminal, start the web app:
   ```sh
   npm run dev
   ```
6. (Optional) Start the mobile app — copy [`apps/mobile/.env.example`](apps/mobile/.env.example) to `apps/mobile/.env`, then:
   ```sh
   npm run dev:mobile
   ```

The web app reads the API location from `VITE_API_BASE_URL`; mobile uses `EXPO_PUBLIC_API_BASE_URL` (both default to `http://localhost:8787`).

## Tests

```sh
npm --prefix backend test   # backend unit + API tests (Vitest, in-memory MongoDB)
npm run test:e2e            # web smoke tests (Playwright)
```

Mobile smoke tests live in [`apps/mobile/.maestro`](apps/mobile/.maestro) and run with [Maestro](https://maestro.mobile.dev/). CI runs on GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
