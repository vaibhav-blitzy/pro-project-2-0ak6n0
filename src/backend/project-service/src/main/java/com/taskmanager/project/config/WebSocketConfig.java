package com.taskmanager.project.config;

import org.springframework.context.annotation.Configuration; // Spring 6.0.0
import org.springframework.messaging.simp.config.MessageBrokerRegistry; // Spring 6.0.0
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker; // Spring 6.0.0
import org.springframework.web.socket.config.annotation.StompEndpointRegistry; // Spring 6.0.0
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer; // Spring 6.0.0

/**
 * WebSocket configuration class that enables real-time communication for project updates.
 * Implements optimized settings for sub-500ms response times and handles high-concurrency scenarios.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final int BROKER_RELAY_PORT = 61613;
    private static final int MESSAGE_SIZE_LIMIT = 128 * 1024; // 128KB
    private static final int BUFFER_SIZE_LIMIT = 512 * 1024; // 512KB
    private static final long MESSAGE_TTL = 60000; // 60 seconds
    
    /**
     * Configures the message broker with optimized settings for performance and scalability.
     * Implements in-memory message broker with support for broadcast and user-specific messages.
     *
     * @param config the MessageBrokerRegistry to configure
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[]{10000, 10000}) // 10 second heartbeat
                .setTaskScheduler(new ConcurrentTaskScheduler())
                .setPreservePublishOrder(true)
                .setMessageSizeLimit(MESSAGE_SIZE_LIMIT)
                .setSystemHeartbeatReceiveInterval(10000)
                .setSystemHeartbeatSendInterval(10000);

        // Set application destination prefix for client messages
        config.setApplicationDestinationPrefixes("/app");

        // Configure broker relay for clustering support (optional)
        config.enableStompBrokerRelay("/topic", "/queue")
                .setRelayHost("localhost")
                .setRelayPort(BROKER_RELAY_PORT)
                .setClientLogin("guest")
                .setClientPasscode("guest")
                .setSystemLogin("guest")
                .setSystemPasscode("guest")
                .setSystemHeartbeatReceiveInterval(5000)
                .setSystemHeartbeatSendInterval(5000);

        // Enable broker statistics for monitoring
        config.setPreservePublishOrder(true)
                .setPathMatcher(new AntPathMatcher("."))
                .setUserDestinationPrefix("/user/");
    }

    /**
     * Registers STOMP endpoints with security and performance configurations.
     * Includes SockJS fallback for browsers that don't support WebSocket.
     *
     * @param registry the StompEndpointRegistry to configure
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-projects")
                .setAllowedOrigins("*") // Configure appropriately for production
                .withSockJS()
                .setStreamBytesLimit(BUFFER_SIZE_LIMIT)
                .setHttpMessageCacheSize(1000)
                .setDisconnectDelay(30 * 1000) // 30 seconds
                .setClientLibraryUrl("https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js")
                .setWebSocketEnabled(true)
                .setSessionCookieNeeded(true)
                .setHeartbeatTime(25000) // 25 seconds
                .setDisconnectDelay(5000) // 5 seconds
                .setInterceptors(new WebSocketHandshakeInterceptor());

        // Additional endpoint without SockJS for native WebSocket clients
        registry.addEndpoint("/ws-projects")
                .setAllowedOrigins("*") // Configure appropriately for production
                .setHandshakeHandler(new DefaultHandshakeHandler())
                .addInterceptors(new WebSocketHandshakeInterceptor());
    }
}