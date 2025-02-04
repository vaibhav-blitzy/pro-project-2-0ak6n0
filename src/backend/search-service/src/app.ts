/**
 * @fileoverview Main application entry point for the search service.
 * Configures NestJS application with Elasticsearch integration, security,
 * monitoring, and health checks.
 * @version 1.0.0
 */

import { NestFactory } from '@nestjs/core'; // v9.0.0
import { Module, Global } from '@nestjs/common'; // v9.0.0
import { ValidationPipe } from '@nestjs/common'; // v9.0.0
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'; // v6.0.0
import helmet from 'helmet'; // v6.0.0
import compression from 'compression'; // v1.7.4
import { TerminusModule } from '@nestjs/terminus'; // v9.0.0

import { SearchController } from './controllers/search.controller';
import { SearchService } from './services/search.service';
import { createElasticsearchClient } from './config/elasticsearch.config';

// Global constants
const PORT = process.env.PORT || 3003;
const API_PREFIX = '/api/v1';
const MAX_REQUEST_SIZE = 50 * 1024 * 1024; // 50MB
const CORRELATION_ID_KEY = 'X-Correlation-ID';

@Global()
@Module({
  imports: [TerminusModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    {
      provide: 'ELASTICSEARCH_CLIENT',
      useFactory: async () => await createElasticsearchClient(),
    },
  ],
  exports: [SearchService],
})
export class SearchModule {}

@Module({
  imports: [SearchModule],
})
export class AppModule {
  private readonly correlationIdKey: string = CORRELATION_ID_KEY;
  private readonly maxRequestSize: number = MAX_REQUEST_SIZE;

  configure(config: any): void {
    // Configure security settings
    config.enableCors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', CORRELATION_ID_KEY],
      credentials: true,
      maxAge: 3600,
    });

    // Setup monitoring and tracing
    config.use((req: any, res: any, next: any) => {
      req.correlationId = req.headers[this.correlationIdKey.toLowerCase()] || 
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader(this.correlationIdKey, req.correlationId);
      next();
    });

    // Configure request size limits
    config.use(compression());
    config.use(helmet());
    config.use((req: any, res: any, next: any) => {
      if (req.headers['content-length'] > this.maxRequestSize) {
        res.status(413).send('Payload too large');
        return;
      }
      next();
    });
  }
}

/**
 * Configures Swagger/OpenAPI documentation
 */
function setupSwagger(app: any): void {
  const config = new DocumentBuilder()
    .setTitle('Search Service API')
    .setDescription('Enterprise-grade search service with Elasticsearch integration')
    .setVersion('1.0.0')
    .addTag('search')
    .addBearerAuth()
    .addApiKey()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}

/**
 * Bootstrap the NestJS application with required configurations
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    validationError: { target: false },
  }));

  // Setup Swagger documentation
  setupSwagger(app);

  // Configure security headers
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
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // Enable compression
  app.use(compression());

  // Set global prefix
  app.setGlobalPrefix(API_PREFIX);

  // Start the application
  await app.listen(PORT, '0.0.0.0', () => {
    console.log(`Search service listening on port ${PORT}`);
    console.log(`API documentation available at http://localhost:${PORT}/api/docs`);
  });
}

// Start the application
bootstrap().catch((error) => {
  console.error('Failed to start search service:', error);
  process.exit(1);
});

export { AppModule, SearchModule };