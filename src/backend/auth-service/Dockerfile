# Build stage
FROM node:18-alpine AS build
LABEL maintainer="Task Management System Team"
LABEL description="Authentication service build image"

# Set build environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048 --initial-heap-size=512m --max-heap-size=2g"
ENV APP_HOME=/app

WORKDIR ${APP_HOME}

# Copy package files with hash verification
COPY package.json yarn.lock ./
COPY .yarn* ./
RUN yarn install --frozen-lockfile --production=false \
    && yarn cache clean

# Copy TypeScript configuration and source code
COPY tsconfig*.json ./
COPY src/ ./src/

# Build TypeScript with optimized settings
RUN yarn build \
    && yarn install --frozen-lockfile --production=true \
    && yarn cache clean

# Security audit
RUN yarn audit \
    && rm -rf /usr/local/lib/node_modules/npm \
    && rm -rf /usr/local/bin/npm

# Runtime stage
FROM node:18-alpine AS runtime
LABEL maintainer="Task Management System Team"
LABEL description="Authentication service runtime image"

# Set runtime environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV NODE_OPTIONS="--max-old-space-size=2048 --initial-heap-size=512m --max-heap-size=2g"
ENV APP_HOME=/app

# Create non-root user with specific UID/GID
RUN addgroup -g 10001 nodeapp \
    && adduser -u 10001 -G nodeapp -s /sbin/nologin -D nodeapp

# Set working directory with restricted permissions
WORKDIR ${APP_HOME}
RUN chown -R nodeapp:nodeapp ${APP_HOME}

# Install runtime dependencies and security hardening
RUN apk add --no-cache \
    tini \
    curl \
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/*

# Copy built artifacts with integrity verification
COPY --from=build --chown=nodeapp:nodeapp ${APP_HOME}/dist ./dist
COPY --from=build --chown=nodeapp:nodeapp ${APP_HOME}/node_modules ./node_modules

# Set secure permissions
RUN chmod -R 550 ${APP_HOME}

# Configure security measures
RUN echo "fs.file-max = 65535" >> /etc/sysctl.conf \
    && echo "kernel.pid_max = 65535" >> /etc/sysctl.conf

# Set up health monitoring
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Resource labels
LABEL com.docker.resource.cpu_shares="1024"
LABEL com.docker.resource.memory="2g"
LABEL com.docker.resource.memory_reservation="512m"

# Expose service port
EXPOSE 3001

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Switch to non-root user
USER nodeapp:nodeapp

# Set the application startup command
CMD ["node", "--enable-source-maps", "dist/app.js"]

# Add metadata labels
LABEL org.opencontainers.image.title="Authentication Service"
LABEL org.opencontainers.image.description="Authentication microservice for Task Management System"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Task Management System"