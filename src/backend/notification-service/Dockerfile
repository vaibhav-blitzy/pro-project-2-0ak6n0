# Build stage
FROM node:18-alpine AS build
LABEL maintainer="Task Management System Team"
LABEL description="Notification service for real-time updates and email delivery"

# Set build environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384 --max-websocket-connections=10000"
ENV WORKDIR=/app

# Set working directory
WORKDIR ${WORKDIR}

# Install build dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package files with strict permissions
COPY --chown=node:node package*.json ./
COPY --chown=node:node tsconfig*.json ./

# Install dependencies with security audit
RUN npm ci --production=false \
    && npm audit \
    && npm cache clean --force

# Copy source code and build
COPY --chown=node:node src/ ./src/
RUN npm run build \
    && npm prune --production

# Runtime stage
FROM node:18-alpine AS runtime
LABEL maintainer="Task Management System Team"
LABEL description="Production runtime for notification service"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Task Management System"

# Set runtime environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384 --max-websocket-connections=10000"
ENV PORT=3002
ENV WEBSOCKET_PORT=3003
ENV WORKDIR=/app

# Install production dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN adduser -D -H -s /sbin/nologin nodeapp \
    && mkdir -p ${WORKDIR} \
    && chown -R nodeapp:nodeapp ${WORKDIR}

# Set working directory
WORKDIR ${WORKDIR}

# Copy built artifacts with strict permissions
COPY --from=build --chown=nodeapp:nodeapp ${WORKDIR}/dist ./dist
COPY --from=build --chown=nodeapp:nodeapp ${WORKDIR}/node_modules ./node_modules
COPY --from=build --chown=nodeapp:nodeapp ${WORKDIR}/package*.json ./

# Configure security limits
RUN ulimit -n 65535 \
    && ulimit -u 2048

# Set up healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Resource constraints
ENV NODE_ICU_DATA=/usr/local/share/icu
ENV NODE_TLS_REJECT_UNAUTHORIZED=1

# Switch to non-root user
USER nodeapp

# Expose service ports
EXPOSE ${PORT}
EXPOSE ${WEBSOCKET_PORT}

# Use dumb-init as init system
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start service with clustering
CMD ["node", "--require", "./dist/tracing.js", "./dist/cluster.js"]

# Resource labels
LABEL com.docker.resource.cpu_shares="1"
LABEL com.docker.resource.cpu_quota="100000"
LABEL com.docker.resource.memory="2g"
LABEL com.docker.resource.memory_reservation="512m"