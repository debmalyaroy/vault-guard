# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for layer caching
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# Copy source and build
COPY . .

# Build args injected at build time; can be overridden via docker build --build-arg
ARG VITE_API_URL=http://localhost:8080
ARG VITE_WS_URL=ws://localhost:8080

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config: SPA routing (redirect 404s to index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Structured access logs to stdout
CMD ["nginx", "-g", "daemon off;"]
