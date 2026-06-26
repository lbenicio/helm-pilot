# Build stage
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:prod

# Production stage
FROM node:24-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Next.js standalone output contains only the needed files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# Next.js standalone creates server.js as entry point
CMD ["node", "server.js"]
