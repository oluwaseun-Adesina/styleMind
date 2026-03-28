<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7bccceb6-e65d-489e-86d5-61766fe71eaa

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Configure the web app in [`apps/web/.env.example`](apps/web/.env.example) or your shell:
   `VITE_API_BASE_URL=http://localhost:8787`
3. Configure the backend in [`backend/.env.example`](backend/.env.example) or your shell:
   `GEMINI_API_KEY=...`
4. Start the backend:
   `npm run dev:backend`
5. In a second terminal, start the web app:
   `npm run dev`

The repo now follows a simple monorepo layout:
- [`apps/web`](apps/web)
- [`apps/mobile`](apps/mobile)
- [`backend`](backend)

The backend exposes `POST /api/outfit-suggestion`, and the web app calls it through `VITE_API_BASE_URL` while mobile uses `EXPO_PUBLIC_API_BASE_URL`.
