# LangKey Frontend

React + Vite + TypeScript + Tailwind web app for LangKey, a language-learning app.

## Quick start

Start the backend first (`docker compose up` in `langkey-backend`), then:

```bash
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` to the backend at `localhost:8000`.

Dev login: `dev@langkey.dev` / `langkey-dev`.

## Container build

```bash
docker build -t langkey-frontend .
```

Produces an nginx image serving the static build (API origin/proxy config for deployment comes later).
