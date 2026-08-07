# FitPick

Your personal AI stylist. FitPick keeps track of your wardrobe and suggests complete outfits — tuned to the occasion, the weather, the season, and what you've worn recently — then generates a flat-lay image of the look using only clothes you actually own.

**Live web app:** https://fitpick-oluwaseun.netlify.app/

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
2. Configure the backend — copy [`backend/.env.example`](backend/.env.example) to `backend/.env` and fill in at least `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, and `GOOGLE_CLIENT_ID`. See [Backend environment variables](#backend-environment-variables) below for the full list.
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

### Backend environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | ✓ | MongoDB connection string |
| `JWT_SECRET` | ✓ | Secret used to sign access/refresh tokens |
| `GEMINI_API_KEY` | ✓ | Google Gemini key, used for outfit suggestions, item analysis, and image generation |
| `GOOGLE_CLIENT_ID` | ✓ | OAuth client ID for "Sign in with Google" |
| `GOOGLE_ALLOWED_AUDIENCES` | – | Comma-separated extra client IDs (e.g. native Android/iOS) whose Google ID tokens are also accepted |
| `OPENWEATHER_API_KEY` | – | Enables weather-aware outfit suggestions |
| `RESEND_API_KEY` / `EMAIL_FROM` | – | Send password-reset codes by email; without a key, codes are logged to the console (dev only) |
| `HF_TOKEN` | – | Hugging Face token, used as an image-generation fallback |
| `PORT` | – | API port (default `8787`) |
| `ALLOWED_ORIGINS` | – | Comma-separated CORS allow-list |
| `NEW_RELIC_LICENSE_KEY` / `NEW_RELIC_APP_NAME` | – | Mirrors audit-trail entries and errors to New Relic; full APM tracing requires `npm run start:apm` |
| `AUDIT_LOG_RETENTION_DAYS` | – | Days to retain audit-trail entries in MongoDB (default `90`) |

## API reference

Base URL: `http://localhost:8787` locally. All request/response bodies are JSON. Authenticated routes require `Authorization: Bearer <accessToken>`.

Rate limits (per IP, configurable via `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` / `AI_RATE_LIMIT_MAX`): 15-min windows for auth and standard routes, 1-minute window for AI routes.

#### Auth — `/api/auth`

| Method & path | Auth | Body | Description |
| --- | --- | --- | --- |
| `POST /google` | – | `{ token }` | Sign in/up with a Google ID token |
| `POST /signup` | – | `{ email, password, name? }` | Create an account |
| `POST /login` | – | `{ email, password }` | Email/password sign-in |
| `POST /refresh` | – | `{ refreshToken }` | Exchange a refresh token for a new access token |
| `POST /forgot-password` | – | `{ email }` | Email a 6-digit reset code (logged to console without `RESEND_API_KEY`) |
| `POST /reset-password` | – | `{ email, code, newPassword }` | Reset password with the emailed code |
| `GET /me` | ✓ | – | Get the current user's profile |
| `PATCH /me` | ✓ | `{ name }` | Update profile |
| `POST /change-password` | ✓ | `{ currentPassword?, newPassword }` | Change password (`currentPassword` optional for Google-only accounts) |
| `DELETE /me` | ✓ | `{ password?, confirm: "DELETE" }` | Delete account and all associated data |

#### Wardrobe — `/api/wardrobes` (all routes ✓ authenticated)

| Method & path | Body | Description |
| --- | --- | --- |
| `GET /` | – | List the user's wardrobe items |
| `POST /` | `{ name, color, type, formality, description? }` | Add a wardrobe item |
| `PUT /:id` | `{ name, color, type, formality, description? }` | Update a wardrobe item |
| `DELETE /:id` | – | Remove a wardrobe item |

`type`: `top` \| `bottom` \| `shoes` \| `accessory`. `formality`: `casual` \| `smart casual` \| `formal`.

#### AI — `/api` (all routes ✓ authenticated, stricter rate limit)

| Method & path | Body | Description |
| --- | --- | --- |
| `POST /outfit-suggestion` | `{ prompt?, auto?, variety?, count?, lat?, lon?, localHour?, localDate?, lockedItemId? }` | Get one or more outfit suggestions from the wardrobe, optionally weather/season/time-aware and built around a locked item. `prompt` is required unless `auto` is `true`. |
| `POST /outfit-image` | `{ suggestion: { occasion, top, bottom, shoes, accessory, stylistNote, wardrobeGap?, wardrobeGapSearchTerm? } }` | Generate an editorial flat-lay image for a suggested outfit |
| `POST /analyze-item` | `{ imageBase64, mimeType, hint? }` | Identify a garment from a photo (name, color, type, formality, description). `mimeType`: `image/jpeg` \| `image/png` \| `image/webp` \| `image/heic` \| `image/heif` |

#### Events — `/api/events` (all routes ✓ authenticated)

| Method & path | Body | Description |
| --- | --- | --- |
| `GET /` | – | List upcoming events |
| `POST /` | `{ title, date, time? }` | Add an event (`date`: `YYYY-MM-DD`, `time`: `HH:MM`) |
| `DELETE /:id` | – | Remove an event |

#### Lookbook — `/api/saved_outfits` (all routes ✓ authenticated)

| Method & path | Body | Description |
| --- | --- | --- |
| `GET /` | – | List saved outfits |
| `POST /` | `{ occasion, top, bottom, shoes, accessory, stylistNote?, wardrobeGap?, wardrobeGapSearchTerm? }` | Save an outfit (`top`/`bottom`/`shoes`/`accessory` are `{ name, reason }`) |
| `POST /:id/worn` | – | Mark a saved outfit as worn |
| `DELETE /:id` | – | Remove a saved outfit |

#### Misc

| Method & path | Description |
| --- | --- |
| `GET /health` | Health check — `{ ok, timestamp, version }` |

## Tests

```sh
npm --prefix backend test   # backend unit + API tests (Vitest, in-memory MongoDB)
npm run test:e2e            # web smoke tests (Playwright)
```

Mobile smoke tests live in [`apps/mobile/.maestro`](apps/mobile/.maestro) and run with [Maestro](https://maestro.mobile.dev/). CI runs on GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
