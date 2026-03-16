FROM oven/bun:latest

# Instalujemy Node.js i npm bezpośrednio w obrazie Bun
# Musimy to zrobić, bo domyślny obraz Bun jest "goły"
RUN apt-get update && apt-get install -y nodejs npm

WORKDIR /app

# Kopiujemy pliki zależności
COPY package.json package-lock.json* bun.lockb* ./

# Teraz npm już tu jest, więc ta komenda przejdzie
RUN npm install --ignore-scripts

# Kopiujemy resztę kodu
COPY . .

# Budujemy projekt (Vite + tsc)
RUN bun run build

# Port aplikacji
EXPOSE 3000

# Startujemy backend
CMD ["bun", "backend/src/index.ts"]