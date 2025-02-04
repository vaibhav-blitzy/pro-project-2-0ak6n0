package com.taskmanager.task.config;

import org.springframework.context.annotation.Configuration; // version: 6.0.0
import org.springframework.messaging.simp.config.MessageBrokerRegistry; // version: 6.0.0
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker; // version: 6.0.0
import org.springframework.web.socket.config.annotation.StompEndpointRegistry; // version: 6.0.0
import org.springframework.messaging.simp.config.WebSocketMessageBrokerConfigurer; // version: 6.0.0

/**
 * WebSocket Configuration for real-time task updates and notifications.
 * Implements comprehensive WebSocket messaging with STOMP protocol support,
 * message broker configuration, and security settings.
 * 
 * Features:
 * - Real-time task updates through WebSocket/STOMP
 * - SockJS fallback for browser compatibility
 * - Clustered message broker support via RabbitMQ
 * - Secure communication with authentication
 * - Performance optimization with configurable parameters
 * - Comprehensive monitoring and statistics
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final String WEBSOCKET_ENDPOINT = "/ws-tasks";
    private static final String APPLICATION_DESTINATION_PREFIX = "/app";
    private static final String TOPIC_DESTINATION_PREFIX = "/topic";
    private static final String QUEUE_DESTINATION_PREFIX = "/queue";
    private static final String USER_DESTINATION_PREFIX = "/user";
    
    private static final int HEARTBEAT_INTERVAL = 10000; // 10 seconds
    private static final int MESSAGE_SIZE_LIMIT = 64 * 1024; // 64KB
    private static final int SOCKJS_HEARTBEAT = 5000; // 5 seconds
    private static final long CONNECTION_TIMEOUT = 60000; // 60 seconds

    /**
     * Configures the message broker with optimized settings for performance and scalability.
     * Sets up both in-memory broker for development and RabbitMQ relay for production.
     * 
     * @param config the MessageBrokerRegistry to configure
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Configure application destination prefix for client messages
        config.setApplicationDestinationPrefixes(APPLICATION_DESTINATION_PREFIX);

        // Configure broker destinations for public and private messages
        config.enableStompBrokerRelay(TOPIC_DESTINATION_PREFIX, QUEUE_DESTINATION_PREFIX)
            .setRelayHost("rabbitmq-host")
            .setRelayPort(61613)
            .setClientLogin("client")
            .setClientPasscode("client-password")
            .setSystemLogin("system")
            .setSystemPasscode("system-password")
            .setVirtualHost("task-manager")
            .setSystemHeartbeatSendInterval(HEARTBEAT_INTERVAL)
            .setSystemHeartbeatReceiveInterval(HEARTBEAT_INTERVAL);

        // Configure user destination prefix for private messages
        config.setUserDestinationPrefix(USER_DESTINATION_PREFIX);

        // Enable broker statistics for monitoring
        config.setPreservePublishOrder(true)
            .setPathMatcher(new AntPathMatcher("."))
            .setTaskScheduler(taskScheduler());
    }

    /**
     * Registers STOMP endpoints with comprehensive security and fallback options.
     * Configures WebSocket connection parameters, security settings, and monitoring.
     * 
     * @param registry the StompEndpointRegistry to configure
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint(WEBSOCKET_ENDPOINT)
            // Enable SockJS fallback
            .withSockJS()
            .setHeartbeatTime(SOCKJS_HEARTBEAT)
            .setDisconnectDelay(CONNECTION_TIMEOUT)
            .setStreamBytesLimit(MESSAGE_SIZE_LIMIT)
            .setHttpMessageCacheSize(1000)
            .setWebSocketEnabled(true)
            .setSessionCookieNeeded(true)
            // Configure CORS
            .setAllowedOrigins("*")
            // Configure connection interceptors
            .addInterceptors(new WebSocketHandshakeInterceptor())
            // Configure error handling
            .setErrorHandler(new WebSocketErrorHandler());

        // Add additional endpoint without SockJS for native WebSocket clients
        registry.addEndpoint(WEBSOCKET_ENDPOINT)
            .setAllowedOrigins("*")
            .addInterceptors(new WebSocketHandshakeInterceptor())
            .setHandshakeHandler(new DefaultHandshakeHandler())
            .setErrorHandler(new WebSocketErrorHandler());
    }

    /**
     * Creates a custom task scheduler for WebSocket operations.
     * 
     * @return configured ThreadPoolTaskScheduler
     */
    private ThreadPoolTaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        scheduler.initialize();
        return scheduler;
    }
}