
FROM node:18-bullseye

# Install build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-distutils \
    make \
    g++ \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Install sqlite3 from source
RUN npm install --production --build-from-source sqlite3

COPY . .

ENV NODE_ENV=production

EXPOSE 4000

CMD ["node", "server.js"]
