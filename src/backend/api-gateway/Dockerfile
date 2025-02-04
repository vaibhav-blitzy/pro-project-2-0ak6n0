# Build stage for API Gateway
FROM node:18-alpine AS builder
LABEL maintainer="Task Management System Team"
LABEL description="API Gateway build stage with Kong integration"

# Set build environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384"
ENV APP_HOME=/app

# Install build dependencies
RUN apk add --no-cache \
    curl \
    bash \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Configure npm for production builds
RUN npm config set depth=0 \
    && npm config set audit=false \
    && npm config set fund=false \
    && npm config set update-notifier=false \
    && npm config set loglevel=warn

WORKDIR ${APP_HOME}

# Copy package files
COPY package*.json ./

# Install dependencies with development packages for building
RUN npm ci --production=false

# Copy source code and configuration files
COPY tsconfig.json ./
COPY src/ ./src/
COPY kong/ ./kong/

# Build TypeScript application
RUN npm run build \
    && npm prune --production \
    && npm cache clean --force

# Generate Kong declarative configuration
RUN node dist/scripts/generate-kong-config.js

# Security audit
RUN npm audit

# Runtime stage
FROM kong:3.3 AS runtime
LABEL maintainer="Task Management System Team"
LABEL description="API Gateway runtime with Kong integration"

# Set runtime environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384"
ENV PORT=3000
ENV KONG_DATABASE=off
ENV KONG_DECLARATIVE_CONFIG=/usr/local/kong/declarative/kong.yml
ENV KONG_PROXY_ACCESS_LOG=/dev/stdout
ENV KONG_ADMIN_ACCESS_LOG=/dev/stdout
ENV KONG_PROXY_ERROR_LOG=/dev/stderr
ENV KONG_ADMIN_ERROR_LOG=/dev/stderr
ENV KONG_PROXY_LISTEN=0.0.0.0:8000
ENV KONG_ADMIN_LISTEN=0.0.0.0:8001

# Create non-root user
RUN adduser -D -u 10001 nodeapp \
    && mkdir -p /app /usr/local/kong/declarative \
    && chown -R nodeapp:nodeapp /app /usr/local/kong/declarative

# Install Node.js runtime
RUN apk add --no-cache nodejs~=18 npm tini curl

WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder --chown=nodeapp:nodeapp /app/dist ./dist
COPY --from=builder --chown=nodeapp:nodeapp /app/node_modules ./node_modules
COPY --from=builder --chown=nodeapp:nodeapp /app/kong/kong.yml /usr/local/kong/declarative/

# Configure security headers
RUN echo "nginx_http_headers = { \
    \"X-Frame-Options\": \"DENY\", \
    \"X-Content-Type-Options\": \"nosniff\", \
    \"X-XSS-Protection\": \"1; mode=block\", \
    \"Strict-Transport-Security\": \"max-age=31536000; includeSubDomains\", \
    \"Content-Security-Policy\": \"default-src 'self'\" \
}" >> /etc/kong/kong.conf

# Configure connection pooling
ENV NODE_OPTIONS="${NODE_OPTIONS} --max-http-header-size=16384 --max-semi-space-size=512"
ENV UV_THREADPOOL_SIZE=32

# Expose ports
EXPOSE 3000 8000 8001

# Switch to non-root user
USER nodeapp

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start Kong and Node.js application
CMD ["sh", "-c", "kong start & node dist/server.js"]

# Add metadata labels
LABEL org.opencontainers.image.title="API Gateway"
LABEL org.opencontainers.image.description="API Gateway service with Kong integration"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Task Management System"
LABEL com.docker.resource.memory="2g"
LABEL com.docker.resource.memory_reservation="512m"
LABEL com.docker.resource.cpu_shares="2"