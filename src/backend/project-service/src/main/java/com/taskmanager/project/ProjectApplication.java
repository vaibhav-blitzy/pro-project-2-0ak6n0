package com.taskmanager.project;

import org.springframework.boot.SpringApplication; // Spring Boot 3.0.0
import org.springframework.boot.autoconfigure.SpringBootApplication; // Spring Boot 3.0.0
import org.springframework.cloud.client.discovery.EnableDiscoveryClient; // Spring Cloud 4.0.0
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.boot.web.servlet.ServletComponentScan;
import org.springframework.boot.actuate.autoconfigure.metrics.MeterRegistryCustomizer;
import io.micrometer.core.instrument.MeterRegistry;

/**
 * Main application class for the Project Service microservice.
 * Provides project management functionality with real-time updates via WebSocket.
 * Implements service discovery for microservices architecture integration.
 * 
 * Features:
 * - Project lifecycle management
 * - Real-time project updates
 * - Service discovery integration
 * - Health monitoring and metrics
 * - Async operation support
 * - Production-ready configuration
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableAsync
@ServletComponentScan
public class ProjectApplication {

    private static final int CORE_POOL_SIZE = 10;
    private static final int MAX_POOL_SIZE = 50;
    private static final int QUEUE_CAPACITY = 100;
    private static final String THREAD_NAME_PREFIX = "project-async-";

    /**
     * Main entry point for the Project Service application.
     * Initializes Spring Boot context with required configurations.
     *
     * @param args command line arguments
     */
    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(ProjectApplication.class);
        
        // Configure application properties
        application.setAddCommandLineProperties(true);
        application.setRegisterShutdownHook(true);
        
        // Start the application
        application.run(args);
    }

    /**
     * Configures the async task executor for handling concurrent operations.
     * Optimized for project management workloads.
     *
     * @return ThreadPoolTaskExecutor configured executor
     */
    @Bean
    public ThreadPoolTaskExecutor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(CORE_POOL_SIZE);
        executor.setMaxPoolSize(MAX_POOL_SIZE);
        executor.setQueueCapacity(QUEUE_CAPACITY);
        executor.setThreadNamePrefix(THREAD_NAME_PREFIX);
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }

    /**
     * Configures metrics registry with project service specific tags.
     * Enables detailed monitoring and alerting capabilities.
     *
     * @return MeterRegistryCustomizer customized registry
     */
    @Bean
    MeterRegistryCustomizer<MeterRegistry> metricsCommonTags() {
        return registry -> registry.config()
            .commonTags("application", "project-service")
            .commonTags("environment", "${spring.profiles.active:default}");
    }

    /**
     * Configures graceful shutdown behavior for the application.
     * Ensures proper cleanup of resources and connections.
     *
     * @return GracefulShutdown shutdown handler
     */
    @Bean
    public GracefulShutdown gracefulShutdown() {
        return new GracefulShutdown();
    }
}

/**
 * Internal class to handle graceful shutdown of the application.
 * Implements proper cleanup of resources during shutdown.
 */
class GracefulShutdown {
    
    /**
     * Performs cleanup operations during shutdown.
     * Ensures all resources are properly released.
     */
    public void onShutdown() {
        // Implement shutdown logic
    }
}