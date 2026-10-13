# Build context: repository root (see docker-compose.yml)
FROM node:20-alpine AS web
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./
COPY database/ /app/database/
COPY --from=web /src/frontend/dist /app/frontend/dist
EXPOSE 4000
CMD ["sh", "scripts/start.sh"]
