# ================================
# Giraffe Terminal - Multi-stage Dockerfile
# ================================

# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the frontend
RUN npm run build

# ================================
# Stage 2: Production Server
# ================================
FROM node:20-alpine AS production

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy server files
COPY server ./server

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist ./dist

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose the backend port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

# Start the server
CMD ["node", "server/index.js"]
