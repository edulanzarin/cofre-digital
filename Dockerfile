FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# smbclient: grava/lê os arquivos direto no compartilhamento de rede (SMB) do
# DC01. É o cliente userspace do Samba — o único que autentica ali (o mount do
# kernel não consegue). Ver src/lib/smb.ts.
RUN apk add --no-cache samba-client
# Usa o usuário `node` embutido na imagem (uid/gid 1000).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
