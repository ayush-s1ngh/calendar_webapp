# Frontend Deployment Guide

This repo’s Next.js app lives in the `frontend/` directory. It builds a production server using `next start`. Ensure the backend API is reachable from the frontend domain and CORS is configured accordingly.

## 1) Requirements
- Node.js 20 LTS or 22 LTS
- npm (or your preferred package manager)
- A reverse proxy (e.g., Nginx) or a container runtime (optional)
- Environment variable:
  - NEXT_PUBLIC_API_BASE_URL → must point to the backend API root (e.g., https://api.example.com/api)

## 2) Environment
Create `frontend/.env` (or set env vars in your platform):
```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api
# Local dev example:
# NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
```

Notes:
- OAuth: The backend redirects users to the frontend at `/oauth-success?token=...`. Ensure the backend uses your deployed frontend URL and CORS allows it.

## 3) Build and Run (VM/bare metal)
From the `frontend/` directory:
```bash
npm ci
npm run build
# Default port is 3000. You can set PORT to change it.
PORT=3000 npm run start
```
- Health check: GET / should return 200 once the app is up.

## 4) Nginx Reverse Proxy (example)
```nginx
server {
  listen 80;
  server_name app.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
- Terminate TLS at Nginx (recommended). Redirect HTTP → HTTPS.

## 5) Docker (example)
Create `frontend/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY ../frontend .
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
```

Build and run:
```bash
docker build -t calendar-frontend \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api \
  frontend/

docker run -d -p 3000:3000 --name calendar-frontend calendar-frontend
```

## 6) Vercel (optional)
- Connect the repo, set `NEXT_PUBLIC_API_BASE_URL` in Project Settings → Environment Variables.
- Framework preset: Next.js. No custom build command needed (`next build`).
- Ensure backend CORS allows the Vercel domain and OAuth redirects to `https://your-vercel-domain/oauth-success`.

## 7) Backend Integration Checklist
- CORS: Allow the frontend origin (HTTPS domain).
- OAuth redirect: Backend must redirect to `https://your-frontend-domain/oauth-success?token=...`.
- API path: The value of NEXT_PUBLIC_API_BASE_URL must include `/api` (per backend docs).

## 8) Troubleshooting
- 401 loops to /login: Verify tokens are returned and the API base URL is correct.
- Mixed content: Use HTTPS for both frontend and API or configure the proxy correctly.
- Blank screen post-deploy: Check server logs (`next start`) and that `.env` is set at build time (especially in Docker).