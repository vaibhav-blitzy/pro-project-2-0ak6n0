/**
 * @fileoverview Enterprise-grade email notification service implementing secure SMTP transport,
 * template rendering, comprehensive delivery tracking, and advanced retry mechanisms.
 * @version 1.0.0
 */

import * as nodemailer from 'nodemailer'; // ^6.9.0
import * as handlebars from 'handlebars'; // ^4.7.0
import * as winston from 'winston'; // ^3.8.0
import { emailConfig } from '../config/email.config';
import { INotification, NotificationType, INotificationDelivery, NotificationPriority } from '../interfaces/notification.interface';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Interface for email delivery options
 */
interface EmailOptions {
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
  cc?: string[];
  bcc?: string[];
  priority?: NotificationPriority;
  replyTo?: string;
}

/**
 * Decorator for retry mechanism
 */
function Retry(options = emailConfig.retryPolicy) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      let lastError: Error;
      for (let attempt = 1; attempt <= options.attempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          if (attempt < options.attempts) {
            const delay = Math.min(
              options.delay * Math.pow(2, attempt - 1),
              options.maxDelay
            );
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      throw lastError!;
    };
    return descriptor;
  };
}

/**
 * Decorator for metrics collection
 */
function Metrics() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const start = process.hrtime();
      try {
        const result = await originalMethod.apply(this, args);
        const [seconds, nanoseconds] = process.hrtime(start);
        metrics.recordEmailMetrics({
          success: true,
          duration: seconds * 1000 + nanoseconds / 1e6,
          template: args[0]?.template
        });
        return result;
      } catch (error) {
        const [seconds, nanoseconds] = process.hrtime(start);
        metrics.recordEmailMetrics({
          success: false,
          duration: seconds * 1000 + nanoseconds / 1e6,
          error: error.message
        });
        throw error;
      }
    };
    return descriptor;
  };
}

@Injectable()
export class EmailService {
  private emailTransport: nodemailer.Transporter;
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();
  private readonly securityConfig = emailConfig.security;
  private readonly rateLimiter: Map<string, number> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly loggerService: LoggerService
  ) {
    this.initializeEmailTransport();
  }

  /**
   * Initializes secure SMTP transport with connection pooling
   */
  private async initializeEmailTransport(): Promise<void> {
    try {
      this.emailTransport = nodemailer.createTransport(emailConfig.smtp);
      await this.emailTransport.verify();
      logger.info('Email transport initialized successfully', {
        host: emailConfig.smtp.host,
        pool: emailConfig.smtp.pool
      });
    } catch (error) {
      logger.error('Failed to initialize email transport', { error });
      throw error;
    }
  }

  /**
   * Sends email notification with comprehensive tracking and security measures
   */
  @Retry()
  @Metrics()
  public async sendNotification(
    notification: INotification,
    recipientEmail: string,
    options: EmailOptions = {}
  ): Promise<INotificationDelivery> {
    try {
      // Rate limiting check
      this.checkRateLimit(recipientEmail);

      // Template processing
      const template = await this.getCompiledTemplate(notification.template);
      const htmlContent = template(notification.metadata);

      // Security headers
      const securityHeaders = this.getSecurityHeaders();

      // Prepare email
      const mailOptions = {
        from: emailConfig.smtp.auth.user,
        to: recipientEmail,
        subject: notification.title,
        html: htmlContent,
        priority: options.priority || notification.priority,
        headers: securityHeaders,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments,
        replyTo: options.replyTo
      };

      // Send email
      const info = await this.emailTransport.sendMail(mailOptions);

      // Track delivery
      const deliveryStatus: INotificationDelivery = {
        notificationId: notification.id,
        method: 'EMAIL',
        status: 'DELIVERED',
        attempts: 1,
        lastAttemptAt: new Date(),
        error: null,
        nextRetryAt: null,
        deliveryMetadata: {
          messageId: info.messageId,
          response: info.response,
          envelope: info.envelope
        },
        acknowledgedAt: new Date()
      };

      logger.info('Email sent successfully', {
        notificationId: notification.id,
        recipient: recipientEmail,
        messageId: info.messageId
      });

      return deliveryStatus;
    } catch (error) {
      logger.error('Failed to send email', {
        notificationId: notification.id,
        recipient: recipientEmail,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Gets and caches compiled email template
   */
  private async getCompiledTemplate(templateName: string): Promise<HandlebarsTemplateDelegate> {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templatePath = join(
      __dirname,
      '../..',
      emailConfig.templates[templateName].html
    );
    const templateContent = await readFile(templatePath, 'utf-8');
    const compiled = handlebars.compile(templateContent);
    this.templateCache.set(templateName, compiled);

    return compiled;
  }

  /**
   * Implements rate limiting for email sending
   */
  private checkRateLimit(recipientEmail: string): void {
    const now = Date.now();
    const windowStart = now - this.securityConfig.rateLimit.window;

    // Clean up old entries
    for (const [email, timestamp] of this.rateLimiter.entries()) {
      if (timestamp < windowStart) {
        this.rateLimiter.delete(email);
      }
    }

    // Check rate limit
    const count = this.rateLimiter.get(recipientEmail) || 0;
    if (count >= this.securityConfig.rateLimit.max) {
      throw new Error('Rate limit exceeded for recipient');
    }

    this.rateLimiter.set(recipientEmail, count + 1);
  }

  /**
   * Generates security headers for email
   */
  private getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Content-Security-Policy': "default-src 'self'",
      'X-Mailer': 'TaskMaster-Secure-Mailer'
    };
  }
}