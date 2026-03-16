FROM oven/bun:latest

WORKDIR /app

# Kopiujemy pliki zależności
# Kopiujemy też package-lock.json (jeśli go masz), żeby npm był szczęśliwy
COPY package.json package-lock.json* bun.lockb* ./

# Używamy npm do instalacji - jest DUŻO stabilniejszy w środowiskach CI
# Dodajemy --ignore-scripts, żeby te nieszczęsne gity nam nie psuły zabawy
RUN npm install --ignore-scripts

# Kopiujemy resztę kodu
COPY . .

# Budujemy projekt (Vite + tsc)
RUN bun run build

# Twoja apka wystawia port (upewnij się, że taki sam masz w Coolify)
EXPOSE 3000

# Startujemy backend za pomocą Bun
CMD ["bun", "backend/src/index.ts"]