# Beacon credential monitor: Next.js app + Prisma/SQLite + Playwright (Chromium) in one container.
# The official Playwright image already contains Chromium and its system libraries; its tag must match
# the "playwright" version in package.json (1.63.0), otherwise chromium.launch() cannot find a browser.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/data/beacon.db \
    PLAYWRIGHT_HEADLESS=true \
    APP_TIMEZONE=America/Indiana/Indianapolis

# Install dependencies first so this layer is cached between code changes.
# postinstall runs "prisma generate", which needs the schema and prisma.config.ts (and lib/env.ts it imports).
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY lib/env.ts ./lib/env.ts
RUN npm ci

# Build the app. Dev dependencies stay in the image: "prisma migrate deploy" runs from the entrypoint.
COPY . .
RUN npm run build

# /app/data is the persistent volume: the SQLite database and the browser recordings.
# deploy/seed/beacon.db (copied from a snapshot by deploy/prepare-seed.sh, never committed) seeds an empty volume.
RUN mkdir -p /app/data /app/seed && \
    if [ -f deploy/seed/beacon.db ]; then cp deploy/seed/beacon.db /app/seed/beacon.db; fi && \
    chmod +x scripts/docker-entrypoint.sh

EXPOSE 3000
CMD ["./scripts/docker-entrypoint.sh"]
