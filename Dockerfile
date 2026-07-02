# Build multi-stage do Next.js (output: standalone) para EasyPanel/Docker.

# ---- deps ----
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm install (não ci) para tolerar diferenças de deps nativas entre SO (lockfile gerado no Windows).
RUN npm install --no-audit --no-fund

# ---- builder ----
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# As NEXT_PUBLIC_* são embutidas no bundle do browser -> precisam existir no BUILD.
# No EasyPanel, configure estes como Build Args.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
# As envs de runtime (EVOLUTION_URL, EVOLUTION_API_KEY, WHATSAPP_WEBHOOK_SECRET)
# são lidas pelos route handlers em tempo de execução -> configure no EasyPanel (Environment).
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
