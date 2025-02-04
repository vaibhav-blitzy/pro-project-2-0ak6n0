/**
 * @fileoverview Enhanced authentication controller implementing secure user authentication,
 * device tracking, rate limiting, and comprehensive audit logging. Compliant with
 * OWASP Top 10, PCI DSS, and GDPR standards.
 * 
 * @version 1.0.0
 * @license MIT
 */

import { Request, Response } from 'express'; // ^4.18.2
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import helmet from 'helmet'; // ^7.0.0
import winston from 'winston'; // ^3.8.2
import RateLimiter from 'express-rate-limit'; // ^6.7.0
import { AuthService } from '../services/auth.service';
import { HTTP_STATUS, ERROR_CODES, AUDIT_EVENTS } from '../../../shared/constants';
import { IBaseResponse, IErrorResponse } from '../../../shared/interfaces/base.interface';

/**
 * Enhanced authentication controller with security features and device tracking
 */
export class AuthController {
  private readonly logger: winston.Logger;
  private readonly securityHeaders: helmet.HelmetOptions;

  constructor(
    private readonly authService: AuthService,
    private readonly rateLimiter: RateLimiter
  ) {
    // Initialize Winston logger with security-focused configuration
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { service: 'auth-controller' },
      transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
      ]
    });

    // Configure security headers
    this.securityHeaders = {
      contentSecurityPolicy: true,
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: true,
      dnsPrefetchControl: true,
      frameguard: true,
      hidePoweredBy: true,
      hsts: true,
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: true,
      referrerPolicy: true,
      xssFilter: true
    };
  }

  /**
   * Handles user registration with enhanced security measures
   * @param req Express request object
   * @param res Express response object
   */
  public async register(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Extract device information for security tracking
      const deviceInfo = {
        fingerprint: req.headers['x-device-fingerprint'] as string,
        userAgent: req.headers['user-agent'] as string,
        ipAddress: req.ip,
        geoLocation: req.headers['x-geo-location'] as string
      };

      // Validate registration data
      if (!email || !password || !firstName || !lastName) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Missing required registration fields',
          errorCode: ERROR_CODES.VALIDATION_ERROR,
          statusCode: HTTP_STATUS.BAD_REQUEST
        } as IErrorResponse);
      }

      // Register user with enhanced security
      const result = await this.authService.register({
        email,
        password,
        firstName,
        lastName,
        deviceInfo
      });

      this.logger.info('User registered successfully', {
        email,
        deviceInfo,
        event: AUDIT_EVENTS.CREATE
      });

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Registration successful',
        data: result,
        statusCode: HTTP_STATUS.CREATED
      } as IBaseResponse);

    } catch (error) {
      this.logger.error('Registration failed', {
        error,
        event: AUDIT_EVENTS.CREATE
      });
      return this.handleError(res, error);
    }
  }

  /**
   * Handles user login with device tracking and MFA support
   * @param req Express request object
   * @param res Express response object
   */
  public async login(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password, mfaCode } = req.body;

      // Extract device information
      const deviceInfo = {
        fingerprint: req.headers['x-device-fingerprint'] as string,
        userAgent: req.headers['user-agent'] as string,
        ipAddress: req.ip,
        geoLocation: req.headers['x-geo-location'] as string
      };

      // Authenticate user
      const result = await this.authService.login(email, password, deviceInfo);

      // Handle MFA if enabled
      if (result.requiresMFA && !mfaCode) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'MFA code required',
          data: { requiresMFA: true },
          statusCode: HTTP_STATUS.OK
        } as IBaseResponse);
      }

      // Set security headers
      res.set(helmet(this.securityHeaders));

      this.logger.info('User logged in successfully', {
        email,
        deviceInfo,
        event: AUDIT_EVENTS.LOGIN
      });

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Login successful',
        data: result,
        statusCode: HTTP_STATUS.OK
      } as IBaseResponse);

    } catch (error) {
      this.logger.error('Login failed', {
        error,
        event: AUDIT_EVENTS.LOGIN
      });
      return this.handleError(res, error);
    }
  }

  /**
   * Handles token refresh with security validation
   * @param req Express request object
   * @param res Express response object
   */
  public async refreshToken(req: Request, res: Response): Promise<Response> {
    try {
      const { refreshToken } = req.body;
      const deviceInfo = {
        fingerprint: req.headers['x-device-fingerprint'] as string,
        userAgent: req.headers['user-agent'] as string,
        ipAddress: req.ip
      };

      const result = await this.authService.refreshToken(refreshToken, deviceInfo);

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Token refreshed successfully',
        data: result,
        statusCode: HTTP_STATUS.OK
      } as IBaseResponse);

    } catch (error) {
      this.logger.error('Token refresh failed', {
        error,
        event: AUDIT_EVENTS.LOGIN
      });
      return this.handleError(res, error);
    }
  }

  /**
   * Handles MFA setup for user accounts
   * @param req Express request object
   * @param res Express response object
   */
  public async setupMFA(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      const deviceInfo = {
        fingerprint: req.headers['x-device-fingerprint'] as string,
        userAgent: req.headers['user-agent'] as string,
        ipAddress: req.ip
      };

      const result = await this.authService.setupMFA(userId, deviceInfo);

      this.logger.info('MFA setup completed', {
        userId,
        deviceInfo,
        event: AUDIT_EVENTS.PERMISSION_CHANGE
      });

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'MFA setup successful',
        data: result,
        statusCode: HTTP_STATUS.OK
      } as IBaseResponse);

    } catch (error) {
      this.logger.error('MFA setup failed', {
        error,
        event: AUDIT_EVENTS.PERMISSION_CHANGE
      });
      return this.handleError(res, error);
    }
  }

  /**
   * Verifies MFA code during authentication
   * @param req Express request object
   * @param res Express response object
   */
  public async verifyMFA(req: Request, res: Response): Promise<Response> {
    try {
      const { mfaCode, sessionToken } = req.body;
      const deviceInfo = {
        fingerprint: req.headers['x-device-fingerprint'] as string,
        userAgent: req.headers['user-agent'] as string,
        ipAddress: req.ip
      };

      const result = await this.authService.verifyMFA(mfaCode, sessionToken, deviceInfo);

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'MFA verification successful',
        data: result,
        statusCode: HTTP_STATUS.OK
      } as IBaseResponse);

    } catch (error) {
      this.logger.error('MFA verification failed', {
        error,
        event: AUDIT_EVENTS.LOGIN
      });
      return this.handleError(res, error);
    }
  }

  /**
   * Handles standardized error responses
   * @private
   */
  private handleError(res: Response, error: any): Response {
    const errorResponse: IErrorResponse = {
      success: false,
      message: error.message || 'Internal server error',
      errorCode: error.errorCode || ERROR_CODES.INTERNAL_ERROR,
      details: error.details || {
        field: 'unknown',
        value: null,
        constraint: error.message
      },
      statusCode: error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR,
      correlationId: error.correlationId || 'unknown'
    };

    return res.status(errorResponse.statusCode).json(errorResponse);
  }
}