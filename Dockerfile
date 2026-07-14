# Imagem única que builda o frontend + servidor e roda o app.
# Funciona em qualquer host que aceite Docker (Render, Railway, Fly.io, etc).
FROM node:22-slim

WORKDIR /app

# Instala dependências (usa npm pra evitar problemas de corepack/pnpm).
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copia o resto e builda (frontend Vite + servidor esbuild).
COPY . .
RUN npm run build

ENV NODE_ENV=production
# O host normalmente injeta PORT; 3000 é o padrão.
ENV PORT=3000
EXPOSE 3000

# Aplica as migrações no banco (cria as tabelas) e sobe o servidor.
CMD ["sh", "-c", "npx drizzle-kit migrate && node dist/index.js"]
