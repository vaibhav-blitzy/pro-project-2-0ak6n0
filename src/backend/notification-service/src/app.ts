/**
 * @fileoverview Main application entry point for the notification service.
 * Implements a high-performance, secure NestJS application with real-time
 * notification capabilities and comprehensive monitoring.
 * @version 1.0.0
 */

import { NestFactory } from '@nestjs/core'; // ^9.0.0
import { ValidationPipe, Logger } from '@nestjs/common'; // ^9.0.0
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'; // ^6.0.0
import helmet from 'helmet'; // ^6.0.0
import compression from 'compression'; // ^1.7.4
import { NotificationModule } from './notification.module';
import { emailConfig } from './config/email.config';
import { rabbitmqConfig } from './config/rabbitmq.config';
import { NotificationService } from './services/notification.service';
import { HTTP_STATUS } from '../../shared/constants';

// Environment variables with type safety
const PORT = process.env.PORT || 3002;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];

/**
 * Configures Swagger documentation with comprehensive API details
 * @param app - NestJS application instance
 */
function setupSwagger(app: any): void {
  const config = new DocumentBuilder()
    .setTitle('Notification Service API')
    .setDescription('Enterprise-grade notification service with real-time capabilities')
    .setVersion('1.0.0')
    .addTag('notifications', 'Notification management endpoints')
    .addBearerAuth()
    .addApiKey()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}

/**
 * Bootstrap the NestJS application with comprehensive configuration
 */
async function bootstrap(): Promise<void> {
  try {
    // Create NestJS application
    const app = await NestFactory.create(NotificationModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
      cors: {
        origin: CORS_ORIGINS,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['X-Total-Count'],
      },
    });

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hidePoweredBy: true,
    }));

    // Compression middleware
    app.use(compression({
      threshold: 1024,
      level: 6,
      memLevel: 8,
    }));

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
      errorHttpStatusCode: HTTP_STATUS.BAD_REQUEST,
    }));

    // Setup Swagger documentation
    setupSwagger(app);

    // Global exception filter
    app.useGlobalFilters(/* custom exception filter implementation */);

    // Initialize RabbitMQ connection
    const amqpConnection = await app.get('AMQP_CONNECTION');
    await amqpConnection.connect(rabbitmqConfig.connection);

    // Verify email configuration
    await app.get(NotificationService).verifyEmailConfiguration(emailConfig);

    // Start server
    await app.listen(PORT);

    // Log startup
    Logger.log(
      `🚀 Notification service running on port ${PORT} in ${NODE_ENV} mode`,
      'Bootstrap'
    );

    // Graceful shutdown
    const signals = ['SIGTERM', 'SIGINT'];
    for (const signal of signals) {
      process.on(signal, async () => {
        Logger.log(`Received ${signal}, starting graceful shutdown`, 'Bootstrap');
        await app.close();
        process.exit(0);
      });
    }

  } catch (error) {
    Logger.error(
      `Failed to start notification service: ${error.message}`,
      error.stack,
      'Bootstrap'
    );
    process.exit(1);
  }
}

// Start application
bootstrap();

// Export for testing
export { bootstrap, setupSwagger };