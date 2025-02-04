import { 
  Controller, 
  UseGuards, 
  UseInterceptors,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseFilters
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiSecurity 
} from '@nestjs/swagger';
import { RateLimit } from '@nestjs/throttler';

import { NotificationService } from '../services/notification.service';
import { 
  INotification,
  NotificationType,
  NotificationPriority
} from '../interfaces/notification.interface';
import { Logger } from '../../../shared/utils/logger';
import { MetricsService } from '../../../shared/utils/metrics';
import { HTTP_STATUS, ERROR_CODES } from '../../../shared/constants';

/**
 * Enhanced controller handling notification-related HTTP endpoints with security,
 * monitoring, and performance optimizations.
 * @version 1.0.0
 */
@Controller('notifications')
@ApiTags('notifications')
@UseGuards(AuthGuard)
@UseInterceptors(LoggingInterceptor, MetricsInterceptor)
@RateLimit({ limit: 1000, ttl: 3600 })
export class NotificationController {
  private readonly correlationIdPrefix = 'notif';

  constructor(
    private readonly notificationService: NotificationService,
    private readonly logger: Logger,
    private readonly metricsService: MetricsService
  ) {
    this.logger = new Logger('NotificationController');
    this.metricsService = new MetricsService('notifications');
  }

  /**
   * Creates a new notification with enhanced validation and security
   */
  @Post()
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiResponse({ 
    status: HTTP_STATUS.CREATED, 
    description: 'Notification created successfully' 
  })
  @ApiResponse({ 
    status: HTTP_STATUS.BAD_REQUEST, 
    description: 'Invalid notification data' 
  })
  @ApiSecurity('bearer')
  @UseFilters(HttpExceptionFilter)
  async createNotification(
    @Body(new ValidationPipe()) notificationData: INotification
  ): Promise<INotification> {
    const correlationId = `${this.correlationIdPrefix}-${crypto.randomUUID()}`;
    const startTime = Date.now();

    try {
      this.logger.info('Creating notification', {
        correlationId,
        type: notificationData.type,
        userId: notificationData.userId
      });

      const notification = await this.notificationService.createNotification(
        notificationData,
        { priority: notificationData.priority === NotificationPriority.HIGH }
      );

      this.metricsService.recordMetric('notification_creation_duration', Date.now() - startTime);
      
      return notification;
    } catch (error) {
      this.logger.error('Failed to create notification', error, {
        correlationId,
        type: notificationData.type
      });
      throw error;
    }
  }

  /**
   * Retrieves user notifications with pagination and filtering
   */
  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({ 
    status: HTTP_STATUS.OK, 
    description: 'Notifications retrieved successfully' 
  })
  @ApiSecurity('bearer')
  async getUserNotifications(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('type') type?: NotificationType,
    @Query('read') read?: boolean
  ): Promise<{ notifications: INotification[]; total: number }> {
    const correlationId = `${this.correlationIdPrefix}-${crypto.randomUUID()}`;
    const startTime = Date.now();

    try {
      this.logger.info('Retrieving user notifications', {
        correlationId,
        userId,
        page,
        limit
      });

      const result = await this.notificationService.getUserNotifications(
        userId,
        { page, limit, type, read }
      );

      this.metricsService.recordMetric('notification_retrieval_duration', Date.now() - startTime);

      return result;
    } catch (error) {
      this.logger.error('Failed to retrieve notifications', error, {
        correlationId,
        userId
      });
      throw error;
    }
  }

  /**
   * Marks notifications as read with batch support
   */
  @Put('read')
  @ApiOperation({ summary: 'Mark notifications as read' })
  @ApiResponse({ 
    status: HTTP_STATUS.OK, 
    description: 'Notifications marked as read' 
  })
  @ApiSecurity('bearer')
  async markAsRead(
    @Body() data: { notificationIds: string[]; userId: string }
  ): Promise<void> {
    const correlationId = `${this.correlationIdPrefix}-${crypto.randomUUID()}`;
    const startTime = Date.now();

    try {
      this.logger.info('Marking notifications as read', {
        correlationId,
        userId: data.userId,
        count: data.notificationIds.length
      });

      await this.notificationService.markAsRead(
        data.notificationIds,
        data.userId
      );

      this.metricsService.recordMetric('notification_update_duration', Date.now() - startTime);
    } catch (error) {
      this.logger.error('Failed to mark notifications as read', error, {
        correlationId,
        userId: data.userId
      });
      throw error;
    }
  }

  /**
   * Retrieves notification statistics for monitoring
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiResponse({ 
    status: HTTP_STATUS.OK, 
    description: 'Statistics retrieved successfully' 
  })
  @ApiSecurity('bearer')
  @UseGuards(AdminGuard)
  async getNotificationStats(): Promise<{
    totalCount: number;
    unreadCount: number;
    typeDistribution: Record<NotificationType, number>;
  }> {
    const correlationId = `${this.correlationIdPrefix}-${crypto.randomUUID()}`;
    const startTime = Date.now();

    try {
      this.logger.info('Retrieving notification statistics', { correlationId });

      const stats = await this.notificationService.getNotificationStats();
      
      this.metricsService.recordMetric('stats_retrieval_duration', Date.now() - startTime);

      return stats;
    } catch (error) {
      this.logger.error('Failed to retrieve notification statistics', error, {
        correlationId
      });
      throw error;
    }
  }
}