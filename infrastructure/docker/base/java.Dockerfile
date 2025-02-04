# Build Stage
# eclipse-temurin:17-jdk-alpine v17.0.9
FROM eclipse-temurin:17-jdk-alpine AS build

# Set build-time environment variables
ENV MAVEN_OPTS="-Xmx3g -Xms1g -XX:+TieredCompilation -XX:TieredStopAtLevel=1" \
    JAVA_HOME=/opt/java/openjdk \
    MAVEN_CONFIG=/root/.m2 \
    APP_HOME=/app

# Install essential build dependencies with version pinning
RUN apk add --no-cache \
    curl=8.4.0-r0 \
    maven=3.9.5-r0 \
    git=2.43.0-r0 \
    # Security scanning tools
    trivy=0.47.0-r0 \
    # Build essentials
    build-base=0.5-r3

# Create app directory
WORKDIR ${APP_HOME}

# Configure Maven settings with optimized repository caching
COPY settings.xml ${MAVEN_CONFIG}/settings.xml

# Copy source code
COPY pom.xml .
COPY src src/

# Security scanning and build
RUN mvn dependency-check:check && \
    trivy filesystem --exit-code 1 --severity HIGH,CRITICAL . && \
    mvn clean package -DskipTests -Dmaven.repo.local=${MAVEN_CONFIG}

# Runtime Stage
# eclipse-temurin:17-jre-alpine v17.0.9
FROM eclipse-temurin:17-jre-alpine AS runtime

# Set runtime environment variables
ENV APP_HOME=/app \
    JAVA_OPTS="-XX:+UseG1GC \
               -XX:+UseContainerSupport \
               -XX:MaxRAMPercentage=75.0 \
               -XX:InitialRAMPercentage=50.0 \
               -XX:+ExitOnOutOfMemoryError \
               -Djava.security.egd=file:/dev/./urandom \
               -Dfile.encoding=UTF-8" \
    SPRING_PROFILES_ACTIVE=production \
    SPRING_SECURITY_OPTS="--add-opens java.base/java.lang=ALL-UNNAMED \
                         --add-opens java.base/java.io=ALL-UNNAMED"

# Install runtime dependencies
RUN apk add --no-cache \
    curl=8.4.0-r0 \
    tini=0.19.0-r1 \
    # Security packages
    dumb-init=1.2.5-r2 \
    tzdata=2023c-r1 && \
    # Create non-root user
    addgroup -S spring && \
    adduser -S spring -G spring && \
    # Create app directory with proper permissions
    mkdir -p ${APP_HOME} && \
    chown -R spring:spring ${APP_HOME}

# Set working directory
WORKDIR ${APP_HOME}

# Copy application artifact from build stage
COPY --from=build --chown=spring:spring ${APP_HOME}/target/*.jar app.jar

# Configure container resource limits
LABEL org.opencontainers.image.cpu.shares="2" \
      org.opencontainers.image.cpu.quota="200000" \
      org.opencontainers.image.cpu.period="100000"

# Security hardening
RUN chmod 500 app.jar && \
    chmod -R 500 ${APP_HOME} && \
    # Remove unnecessary permissions
    chmod -R g-w /etc && \
    chmod -R g-w /var && \
    # Set proper file ownership
    chown -R spring:spring ${APP_HOME}

# Switch to non-root user
USER spring:spring

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

# Start application with optimized JVM settings
CMD ["sh", "-c", "java $JAVA_OPTS $SPRING_SECURITY_OPTS -jar app.jar"]

# Expose application port
EXPOSE 8080