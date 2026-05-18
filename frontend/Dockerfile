FROM node:22-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# ── Serve with nginx ──────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Proxy /api/* → backend (set BACKEND_URL at runtime)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
