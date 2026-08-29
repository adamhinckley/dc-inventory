# Fastify API only. Keep the pnpm workspace layout so package source
# exports resolve (pnpm deploy --legacy drops nested workspace links).
FROM node:24-bookworm-slim
WORKDIR /repo
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api ./apps/api
COPY packages ./packages
RUN pnpm install --frozen-lockfile --prod --filter @dc-inventory/api...
WORKDIR /repo/apps/api
USER node
EXPOSE 8080
CMD ["pnpm", "start"]
