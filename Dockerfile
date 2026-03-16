FROM oven/bun:latest

WORKDIR /app

# Kopiujemy pliki zależności
COPY package.json bun.lockb ./

# Instalujemy paczki (ignorujemy skrypty gita, które wywalały błąd)
RUN bun install --ignore-scripts

# Kopiujemy resztę kodu
COPY . .

# Budujemy frontend (Vite)
RUN bun run build

# Twoja apka wystawia port (ustaw taki sam w Coolify)
EXPOSE 3000

# Startujemy backend
CMD ["bun", "backend/src/index.ts"]