# Build Stage
FROM eclipse-temurin:17-jdk-alpine AS build

# Build-time environment variables
ENV MAVEN_OPTS="-Xmx3g -Xms1g -XX:+TieredCompilation -XX:TieredStopAtLevel=1" \
    JAVA_HOME=/opt/java/openjdk \
    MAVEN_CONFIG=/root/.m2 \
    APP_HOME=/app \
    APP_VERSION="1.0.0"

# Install build dependencies with version pinning
RUN apk add --no-cache \
    curl=8.4.0-r0 \
    maven=3.9.5-r0 \
    git=2.43.0-r0 \
    trivy=0.47.0-r0 \
    build-base=0.5-r3

# Set up build directory
WORKDIR ${APP_HOME}

# Copy Maven configuration for dependency resolution
COPY pom.xml .
COPY settings.xml ${MAVEN_CONFIG}/settings.xml

# Download dependencies separately to leverage Docker layer caching
RUN mvn dependency:go-offline -B

# Copy source code
COPY src src/

# Security scanning and production build
RUN mvn dependency-check:check && \
    trivy filesystem --exit-code 1 --severity HIGH,CRITICAL . && \
    mvn clean package -DskipTests -Pprod -Dmaven.repo.local=${MAVEN_CONFIG} && \
    # Verify JAR signature
    jarsigner -verify target/*.jar

# Runtime Stage
FROM eclipse-temurin:17-jre-alpine AS runtime

# Runtime environment variables
ENV APP_HOME=/app \
    APP_NAME="task-service" \
    APP_VERSION="1.0.0" \
    TZ=UTC \
    SPRING_PROFILES_ACTIVE=prod \
    JAVA_OPTS="-XX:+UseContainerSupport \
               -XX:MaxRAMPercentage=75.0 \
               -XX:+UseG1GC \
               -XX:+UseStringDeduplication \
               -Djava.security.egd=file:/dev/./urandom \
               -Dfile.encoding=UTF-8" \
    SECURITY_OPTS="--security-opt=no-new-privileges --read-only"

# Install runtime dependencies
RUN apk add --no-cache \
    curl=8.4.0-r0 \
    tini=0.19.0-r1 \
    tzdata=2023c-r1 \
    # Install JMX exporter for metrics
    prometheus-jmx-exporter=0.20.0-r0 && \
    # Create non-root user
    addgroup -S spring && \
    adduser -S spring -G spring && \
    # Create app directory with proper permissions
    mkdir -p ${APP_HOME} && \
    chown -R spring:spring ${APP_HOME}

WORKDIR ${APP_HOME}

# Copy JMX exporter configuration
COPY --chown=spring:spring jmx-config.yml /etc/jmx/config.yml

# Copy application artifact from build stage
COPY --from=build --chown=spring:spring ${APP_HOME}/target/*.jar app.jar

# Configure container resource limits
LABEL org.opencontainers.image.cpu.shares="2" \
      org.opencontainers.image.cpu.quota="200000" \
      org.opencontainers.image.cpu.period="100000" \
      org.opencontainers.image.memory.limit="4g" \
      org.opencontainers.image.memory.reservation="2g"

# Security hardening
RUN chmod 444 app.jar && \
    chmod 444 /etc/jmx/config.yml && \
    chmod -R 500 ${APP_HOME} && \
    # Remove unnecessary permissions
    chmod -R g-w /etc && \
    chmod -R g-w /var && \
    # Set proper file ownership
    chown -R spring:spring ${APP_HOME}

# Switch to non-root user
USER spring:spring

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

# Start application with JMX exporter and optimized settings
CMD ["sh", "-c", "java -javaagent:/usr/share/java/prometheus-jmx-exporter/jmx_prometheus_javaagent.jar=9404:/etc/jmx/config.yml ${JAVA_OPTS} -jar app.jar"]

# Expose application and metrics ports
EXPOSE 8080 9404