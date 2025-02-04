# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies and build application
RUN apk add --no-cache python3 make g++ \
    && npm ci \
    && npm run build \
    && npm prune --production

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs nodejs

# Set working directory
WORKDIR /usr/src/app

# Copy built artifacts and production dependencies
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

# Set secure permissions
RUN chown -R nodejs:nodejs /usr/src/app

# Configure environment variables
ENV NODE_ENV=production \
    PORT=3003 \
    NODE_OPTIONS="--max-old-space-size=2048" \
    TZ=UTC

# Set up health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3003

# Configure resource limits and runtime optimizations
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384 --no-deprecation"

# Start application with optimized settings
CMD ["node", "--max-old-space-size=2048", "dist/main.js"]