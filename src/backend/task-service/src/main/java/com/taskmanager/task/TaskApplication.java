package com.taskmanager.task;

import org.springframework.boot.SpringApplication; // version: 3.0.0
import org.springframework.boot.autoconfigure.SpringBootApplication; // version: 3.0.0
import org.springframework.scheduling.annotation.EnableAsync; // version: 6.0.0
import org.springframework.cache.annotation.EnableCaching; // version: 6.0.0
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.context.annotation.Bean;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

import com.github.benmanes.caffeine.cache.Caffeine;

/**
 * Main application class for the Task Management Service microservice.
 * Provides enterprise-grade task management capabilities with support for:
 * - Real-time updates via WebSocket
 * - Asynchronous task processing
 * - Performance optimization through caching
 * - Comprehensive monitoring and health checks
 * 
 * Performance targets:
 * - API response time: < 500ms
 * - System uptime: > 99.9%
 * - Concurrent users: 10,000+
 */
@SpringBootApplication
@EnableAsync(proxyTargetClass = true)
@EnableCaching(proxyTargetClass = true)
public class TaskApplication {
    
    private static final Logger logger = LoggerFactory.getLogger(TaskApplication.class);
    private static final String APPLICATION_NAME = "Task Management Service";
    private static final int CORE_POOL_SIZE = 8;
    private static final int MAX_POOL_SIZE = 32;
    private static final int QUEUE_CAPACITY = 100;
    private static final String THREAD_NAME_PREFIX = "task-async-";

    /**
     * Application entry point with enhanced initialization and monitoring.
     * 
     * @param args command line arguments
     */
    public static void main(String[] args) {
        logger.info("Starting {} at {}", APPLICATION_NAME, 
            LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        try {
            ConfigurableApplicationContext context = SpringApplication.run(TaskApplication.class, args);
            Environment env = context.getEnvironment();
            
            logger.info("{} started successfully on port(s): {} (http) {} (websocket)",
                APPLICATION_NAME,
                env.getProperty("server.port"),
                env.getProperty("websocket.port", "8085"));
            
            // Log active profiles
            String[] activeProfiles = env.getActiveProfiles();
            logger.info("Active profiles: {}", String.join(", ", activeProfiles));
            
        } catch (Exception e) {
            logger.error("Failed to start {}: {}", APPLICATION_NAME, e.getMessage(), e);
            System.exit(1);
        }
    }

    /**
     * Configures the async task executor for optimal performance.
     * 
     * @return configured ThreadPoolTaskExecutor
     */
    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(CORE_POOL_SIZE);
        executor.setMaxPoolSize(MAX_POOL_SIZE);
        executor.setQueueCapacity(QUEUE_CAPACITY);
        executor.setThreadNamePrefix(THREAD_NAME_PREFIX);
        executor.setRejectedExecutionHandler(new java.util.concurrent.ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }

    /**
     * Configures the cache manager for performance optimization.
     * 
     * @return configured CacheManager
     */
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(30, TimeUnit.MINUTES)
            .recordStats());
        
        // Configure specific caches with different policies
        cacheManager.setCacheNames(java.util.Arrays.asList(
            "tasks",
            "projects",
            "users",
            "configurations"
        ));
        
        return cacheManager;
    }

    /**
     * Configures application health indicators.
     * 
     * @return configured HealthIndicator
     */
    @Bean
    public org.springframework.boot.actuate.health.HealthIndicator taskServiceHealth() {
        return () -> {
            return new org.springframework.boot.actuate.health.Health.Builder()
                .up()
                .withDetail("service", APPLICATION_NAME)
                .withDetail("timestamp", System.currentTimeMillis())
                .build();
        };
    }
}