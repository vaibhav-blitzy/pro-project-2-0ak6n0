/**
 * @fileoverview Email service configuration module providing comprehensive SMTP settings,
 * security controls, and template management for the notification service.
 * @version 1.0.0
 */

import * as nodemailer from 'nodemailer'; // ^6.9.0
import { NotificationType, IEmailNotification } from '../interfaces/notification.interface';
import crypto from 'crypto';

/**
 * Interface for validated SMTP configuration
 */
interface ISmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  pool: {
    maxConnections: number;
    maxMessages: number;
    rateDelta: number;
    rateLimit: number;
  };
  tls: {
    ciphers: string;
    minVersion: string;
    rejectUnauthorized: boolean;
  };
}

/**
 * Decorator for configuration validation
 */
function validateConfig(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function(...args: any[]) {
    const config = originalMethod.apply(this, args);
    if (!validateEmailConfig(config)) {
      throw new Error('Invalid email configuration');
    }
    return config;
  };
  return descriptor;
}

/**
 * Creates and validates SMTP transport configuration
 */
@validateConfig
function createTransportConfig(): ISmtpConfig {
  try {
    const encryptedConfig = process.env.SMTP_CONFIG;
    if (!encryptedConfig) {
      throw new Error('SMTP configuration not found');
    }

    // Decrypt configuration using environment key
    const decipher = crypto.createDecipher(
      'aes-256-cbc',
      process.env.EMAIL_ENCRYPTION_KEY || ''
    );
    const decrypted = decipher.update(encryptedConfig, 'hex', 'utf8') + 
                      decipher.final('utf8');
    const config = JSON.parse(decrypted);

    return {
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass
      },
      pool: {
        maxConnections: 10,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 20
      },
      tls: {
        ciphers: 'HIGH:MEDIUM:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5',
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      }
    };
  } catch (error) {
    throw new Error(`Failed to create transport config: ${error.message}`);
  }
}

/**
 * Validates email configuration security settings
 */
function validateEmailConfig(config: ISmtpConfig): boolean {
  if (!config.host || !config.port || !config.auth.user || !config.auth.pass) {
    return false;
  }

  if (!config.tls || config.tls.minVersion !== 'TLSv1.2') {
    return false;
  }

  if (!config.pool || config.pool.maxConnections < 1) {
    return false;
  }

  return true;
}

/**
 * Email configuration object with comprehensive settings
 */
export const emailConfig = {
  smtp: createTransportConfig(),
  
  security: {
    encryption: {
      algorithm: 'aes-256-cbc',
      keyRotation: true
    },
    rateLimit: {
      window: 3600000, // 1 hour
      max: 1000 // maximum emails per window
    }
  },

  retryPolicy: {
    attempts: 3,
    delay: 1000,
    backoff: true,
    maxDelay: 30000
  },

  templates: {
    taskAssigned: {
      id: 'task-assigned',
      html: './templates/task-assigned.html',
      text: './templates/task-assigned.txt',
      variables: ['taskTitle', 'assignerName', 'taskUrl']
    },
    taskUpdated: {
      id: 'task-updated',
      html: './templates/task-updated.html',
      text: './templates/task-updated.txt',
      variables: ['taskTitle', 'updaterName', 'changes', 'taskUrl']
    }
  },

  monitoring: {
    metrics: {
      enabled: true,
      detailed: true
    },
    logging: {
      level: 'info',
      format: 'json'
    }
  }
};

/**
 * Default transport instance with security settings
 */
export const transport = nodemailer.createTransport(emailConfig.smtp);

// Verify transport configuration on module load
transport.verify()
  .then(() => console.log('Email transport verified'))
  .catch(error => console.error('Email transport verification failed:', error));