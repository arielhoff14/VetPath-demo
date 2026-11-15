FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY . .
RUN npm ci --include=dev && npm cache clean --force && npm run build && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["sh", "-c", "node --import tsx scripts/setup.ts && npm start"]
