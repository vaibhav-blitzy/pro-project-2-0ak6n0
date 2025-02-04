# Build Stage
FROM eclipse-temurin:17-jdk-alpine AS build

# Set build-time environment variables
ENV MAVEN_OPTS="-Xmx3g -XX:+TieredCompilation -XX:TieredStopAtLevel=1" \
    MAVEN_CONFIG="-Dmaven.test.skip=true -Dmaven.repo.local=/build/.m2/repository" \
    APP_HOME=/app

# Install build dependencies with version pinning
RUN apk add --no-cache \
    curl=8.4.0-r0 \
    maven=3.9.5-r0 \
    git=2.43.0-r0 \
    # Security scanning tools
    trivy=0.47.0-r0 \
    # Build essentials
    build-base=0.5-r3

# Set up build directory
WORKDIR ${APP_HOME}

# Set up Maven repository caching
RUN mkdir -p /build/.m2/repository && \
    chmod -R 777 /build/.m2

# Copy Maven POM file for dependency resolution
COPY pom.xml .

# Download dependencies in separate layer
RUN mvn dependency:go-offline ${MAVEN_CONFIG}

# Copy source code with optimized .dockerignore
COPY src ./src/

# Run security scanning on dependencies
RUN mvn dependency-check:check && \
    trivy filesystem --exit-code 1 --severity HIGH,CRITICAL .

# Build application with Maven in production mode
RUN mvn clean package ${MAVEN_CONFIG} -Pprod && \
    # Verify build artifacts
    test -f target/*.jar

# Runtime Stage
FROM eclipse-temurin:17-jre-alpine AS runtime

# Set environment variables
ENV APP_HOME=/app \
    JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0 -XX:+UseG1GC -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp -Djava.security.egd=file:/dev/./urandom -Dserver.tomcat.max-threads=200" \
    SPRING_PROFILES_ACTIVE=prod

# Create non-root user and setup directories
RUN addgroup -S spring && \
    adduser -S spring -G spring && \
    mkdir -p ${APP_HOME} /logs && \
    chown -R spring:spring ${APP_HOME} /logs

# Install runtime monitoring tools
RUN apk add --no-cache \
    curl=8.4.0-r0 \
    tini=0.19.0-r1 \
    dumb-init=1.2.5-r2

WORKDIR ${APP_HOME}

# Copy JAR from build stage with verification
COPY --from=build --chown=spring:spring ${APP_HOME}/target/*.jar app.jar
RUN sha256sum app.jar > app.jar.sha256

# Configure logging directories
VOLUME ["/logs", "/tmp"]

# Set up health check endpoints
HEALTHCHECK --interval=30s \
            --timeout=10s \
            --retries=3 \
            --start-period=40s \
            --start-interval=5s \
            CMD curl -f http://localhost:8080/actuator/health || exit 1

# Configure resource limits
RUN echo "kernel.threads-max = 200" > /etc/sysctl.d/99-docker.conf

# Set security options
RUN chmod 500 app.jar && \
    chmod -R 500 ${APP_HOME} && \
    chmod -R g-w /etc && \
    chmod -R g-w /var

# Switch to non-root user
USER spring:spring

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

# Configure entry point with proper signal handling
CMD ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]

# Expose service port
EXPOSE 8080

# Add metadata labels
LABEL maintainer="Task Management System Team" \
      version="1.0" \
      description="Project Service for Task Management System" \
      org.opencontainers.image.cpu.shares="2" \
      org.opencontainers.image.cpu.quota="200000" \
      org.opencontainers.image.cpu.period="100000"