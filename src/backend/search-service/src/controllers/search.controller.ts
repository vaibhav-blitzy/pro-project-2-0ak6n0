/**
 * @fileoverview Enterprise-grade search controller implementing RESTful endpoints
 * for search operations with advanced error handling, rate limiting, and monitoring.
 * @version 1.0.0
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  UsePipes,
  Logger,
  ValidationPipe,
} from '@nestjs/common'; // v9.0.0
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger'; // v6.0.0
import {
  RateLimit,
  SkipThrottle,
  ThrottlerGuard,
} from '@nestjs/throttler'; // v4.0.0
import { CircuitBreaker } from '@nestjs/circuit-breaker'; // v1.0.0

import { SearchService } from '../services/search.service';
import { ISearchQuery, ISearchResponse } from '../interfaces/search.interface';
import { HTTP_STATUS, ERROR_CODES } from '../../shared/constants';
import { IBaseResponse } from '../../shared/interfaces/base.interface';

@Controller('search')
@ApiTags('Search')
@UseGuards(ThrottlerGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class SearchController {
  private readonly logger: Logger;

  constructor(private readonly searchService: SearchService) {
    this.logger = new Logger('SearchController');
  }

  /**
   * Performs search operation with performance monitoring and rate limiting
   */
  @Post(':index')
  @RateLimit({ points: 1000, duration: 60 })
  @UseCircuitBreaker()
  @ApiOperation({ summary: 'Search documents with advanced filtering' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async search(
    @Param('index') index: string,
    @Body() searchQuery: ISearchQuery
  ): Promise<IBaseResponse<ISearchResponse>> {
    const correlationId = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      this.logger.log(`[${correlationId}] Executing search query for index: ${index}`);

      const searchResponse = await this.searchService.search(
        { ...searchQuery, correlationId },
        index
      );

      const duration = Date.now() - startTime;
      this.logger.log(`[${correlationId}] Search completed in ${duration}ms`);

      return {
        success: searchResponse.success,
        message: searchResponse.message,
        data: searchResponse,
        statusCode: searchResponse.statusCode,
        correlationId
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Search operation failed: ${error.message}`,
        error.stack
      );

      return {
        success: false,
        message: `Search operation failed: ${error.message}`,
        data: null,
        statusCode: error.response?.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR,
        correlationId
      };
    }
  }

  /**
   * Indexes a single document with validation and error handling
   */
  @Post(':index/document')
  @RateLimit({ points: 500, duration: 60 })
  @ApiOperation({ summary: 'Index a single document' })
  @ApiResponse({ status: 201, description: 'Document indexed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid document format' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async indexDocument(
    @Param('index') index: string,
    @Body() document: Record<string, any>
  ): Promise<IBaseResponse<{ id: string }>> {
    const correlationId = `index-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.logger.log(`[${correlationId}] Indexing document in index: ${index}`);

      const result = await this.searchService.bulkIndex(index, [document], {
        refresh: true
      });

      if (!result.success) {
        throw new Error('Document indexing failed');
      }

      return {
        success: true,
        message: 'Document indexed successfully',
        data: { id: result.indexed.toString() },
        statusCode: HTTP_STATUS.CREATED,
        correlationId
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Document indexing failed: ${error.message}`,
        error.stack
      );

      return {
        success: false,
        message: `Document indexing failed: ${error.message}`,
        data: null,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        correlationId
      };
    }
  }

  /**
   * Performs bulk indexing with progress tracking and error handling
   */
  @Post(':index/bulk')
  @RateLimit({ points: 100, duration: 60 })
  @ApiOperation({ summary: 'Bulk index multiple documents' })
  @ApiResponse({ status: 201, description: 'Documents indexed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid documents format' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async bulkIndex(
    @Param('index') index: string,
    @Body() documents: Record<string, any>[]
  ): Promise<IBaseResponse<{ indexed: number; failed: number }>> {
    const correlationId = `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.logger.log(
        `[${correlationId}] Starting bulk indexing of ${documents.length} documents`
      );

      const result = await this.searchService.bulkIndex(index, documents, {
        batchSize: 1000,
        refresh: true
      });

      return {
        success: result.success,
        message: result.success
          ? 'Bulk indexing completed successfully'
          : 'Bulk indexing completed with errors',
        data: {
          indexed: result.indexed,
          failed: result.failed
        },
        statusCode: result.success ? HTTP_STATUS.CREATED : HTTP_STATUS.BAD_REQUEST,
        correlationId
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Bulk indexing failed: ${error.message}`,
        error.stack
      );

      return {
        success: false,
        message: `Bulk indexing failed: ${error.message}`,
        data: { indexed: 0, failed: documents.length },
        statusCode: HTTP_STATUS.BAD_REQUEST,
        correlationId
      };
    }
  }
}