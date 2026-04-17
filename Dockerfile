FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx svelte-kit sync

# Required build args for $env/static/* imports (baked into the bundle)
# Pass via: docker build --build-arg PUBLIC_SUPABASE_URL=... --build-arg PUBLIC_SUPABASE_ANON_KEY=... --build-arg SUPABASE_SERVICE_ROLE_KEY=...
ARG PUBLIC_SUPABASE_URL=http://placeholder
ARG PUBLIC_SUPABASE_ANON_KEY=placeholder
ARG SUPABASE_SERVICE_ROLE_KEY=placeholder
ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL
ENV PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

RUN npm run build
RUN npm prune --omit=dev

# --- Production stage ---
FROM node:22-alpine

RUN apk add --no-cache tini
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/package.json .
COPY --from=builder /app/package-lock.json .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "build"]
