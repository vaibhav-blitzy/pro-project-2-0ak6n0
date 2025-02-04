# Build Stage
FROM node:18-alpine AS build
LABEL maintainer="Task Management System Team"
LABEL description="Base build image for Node.js microservices"

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

# Configure npm for production
RUN npm config set depth=0 \
    && npm config set audit=false \
    && npm config set fund=false \
    && npm config set update-notifier=false \
    && npm config set loglevel=warn

# Set up security configurations
RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp \
    && mkdir -p ${APP_HOME} \
    && chown -R nodeapp:nodeapp ${APP_HOME}

# Configure resource limits and ulimits
RUN ulimit -n 65535 \
    && ulimit -u 2048

WORKDIR ${APP_HOME}

# Runtime Stage
FROM node:18-alpine AS runtime
LABEL maintainer="Task Management System Team"
LABEL description="Base runtime image for Node.js microservices"

# Set runtime environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384"
ENV APP_HOME=/app

# Install minimal runtime dependencies
RUN apk add --no-cache \
    curl \
    tini \
    && rm -rf /var/cache/apk/*

# Create non-root user and set up directory structure
RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp \
    && mkdir -p ${APP_HOME} \
    && chown -R nodeapp:nodeapp ${APP_HOME}

# Security hardening
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -rf /usr/local/bin/npm \
    && rm -rf /tmp/* \
    && rm -rf /var/cache/apk/*

# Configure Node.js options for containers
ENV NODE_ICU_DATA=/usr/local/share/icu
ENV NODE_TLS_REJECT_UNAUTHORIZED=1
ENV NODE_NO_WARNINGS=1

WORKDIR ${APP_HOME}

# Set up healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Switch to non-root user
USER nodeapp:nodeapp

# Default command (can be overridden)
CMD ["node", "server.js"]

# Set resource constraints
LABEL com.docker.resource.cpu_shares="1"
LABEL com.docker.resource.cpu_quota="100000"
LABEL com.docker.resource.memory="2g"
LABEL com.docker.resource.memory_reservation="512m"

# Expose default Node.js port
EXPOSE 3000

# Add metadata labels
LABEL org.opencontainers.image.title="Node.js Base Image"
LABEL org.opencontainers.image.description="Base image for Node.js microservices"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Task Management System"
LABEL org.opencontainers.image.url="https://github.com/task-management-system"
LABEL org.opencontainers.image.documentation="https://docs.task-management-system.com"