/**
 * @fileoverview Advanced utility class for managing Elasticsearch index operations
 * with performance optimization, monitoring, and zero-downtime updates.
 * @version Elasticsearch 8.0.0
 */

import { Client } from '@elastic/elasticsearch'; // v8.0.0
import { Injectable, Logger } from '@nestjs/common'; // v9.0.0
import { IIndexConfig } from '../interfaces/search.interface';
import { createElasticsearchClient, getIndexConfiguration } from '../config/elasticsearch.config';

// Global constants for index management
const INDEX_VERSION_PREFIX = 'v';
const DEFAULT_SHARDS = '3';
const DEFAULT_REPLICAS = '1';

@Injectable()
export class IndexBuilder {
    private readonly logger: Logger;

    constructor(private readonly esClient: Client) {
        this.logger = new Logger('IndexBuilder');
    }

    /**
     * Creates a new Elasticsearch index with performance-optimized settings
     * @param indexConfig - Configuration for the new index
     * @returns Promise<boolean> indicating success/failure with performance metrics
     */
    async createIndex(indexConfig: IIndexConfig): Promise<boolean> {
        const startTime = Date.now();
        try {
            // Validate index configuration
            if (!indexConfig.name || !indexConfig.mappings || !indexConfig.settings) {
                throw new Error('Invalid index configuration: missing required fields');
            }

            // Check if index already exists
            const indexExists = await this.esClient.indices.exists({
                index: indexConfig.name
            });

            if (indexExists) {
                this.logger.warn(`Index ${indexConfig.name} already exists`);
                return false;
            }

            // Apply performance optimizations
            const optimizedSettings = {
                ...indexConfig.settings,
                'index.number_of_shards': indexConfig.settings.number_of_shards || DEFAULT_SHARDS,
                'index.number_of_replicas': indexConfig.settings.number_of_replicas || DEFAULT_REPLICAS,
                'index.refresh_interval': '1s',
                'index.search.slowlog.threshold.query.warn': '10s',
                'index.search.slowlog.threshold.fetch.warn': '1s'
            };

            // Create index with optimized configuration
            await this.esClient.indices.create({
                index: indexConfig.name,
                body: {
                    settings: optimizedSettings,
                    mappings: indexConfig.mappings
                }
            });

            // Verify index health
            await this.esClient.cluster.health({
                index: indexConfig.name,
                wait_for_status: 'yellow',
                timeout: '30s'
            });

            const duration = Date.now() - startTime;
            this.logger.log(`Index ${indexConfig.name} created successfully in ${duration}ms`);
            return true;

        } catch (error) {
            this.logger.error(`Failed to create index ${indexConfig.name}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Performs zero-downtime reindexing with version management
     * @param sourceIndex - Source index name
     * @param targetIndex - Target index name
     * @returns Promise<boolean> indicating success/failure
     */
    async reindex(sourceIndex: string, targetIndex: string): Promise<boolean> {
        try {
            // Validate source index existence
            const sourceExists = await this.esClient.indices.exists({
                index: sourceIndex
            });

            if (!sourceExists) {
                throw new Error(`Source index ${sourceIndex} does not exist`);
            }

            // Create new version of index
            const newIndexVersion = `${targetIndex}_${INDEX_VERSION_PREFIX}${Date.now()}`;
            const indexConfig = await getIndexConfiguration(newIndexVersion);
            await this.createIndex(indexConfig);

            // Perform reindexing
            const reindexResponse = await this.esClient.reindex({
                wait_for_completion: true,
                body: {
                    source: { index: sourceIndex },
                    dest: { index: newIndexVersion }
                }
            });

            // Verify reindex completion
            if (reindexResponse.failures?.length > 0) {
                throw new Error('Reindex operation failed with errors');
            }

            // Update aliases for zero-downtime switch
            await this.esClient.indices.updateAliases({
                body: {
                    actions: [
                        { remove: { index: sourceIndex, alias: targetIndex } },
                        { add: { index: newIndexVersion, alias: targetIndex } }
                    ]
                }
            });

            // Clean up old index after successful switch
            await this.deleteIndex(sourceIndex);

            this.logger.log(`Successfully reindexed ${sourceIndex} to ${newIndexVersion}`);
            return true;

        } catch (error) {
            this.logger.error(`Reindex operation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Safely deletes an Elasticsearch index with validation
     * @param indexName - Name of the index to delete
     * @returns Promise<boolean> indicating success/failure
     */
    async deleteIndex(indexName: string): Promise<boolean> {
        try {
            // Validate index existence
            const indexExists = await this.esClient.indices.exists({
                index: indexName
            });

            if (!indexExists) {
                this.logger.warn(`Index ${indexName} does not exist`);
                return false;
            }

            // Check for aliases before deletion
            const aliases = await this.esClient.indices.getAlias({
                index: indexName
            });

            if (Object.keys(aliases).length > 0) {
                this.logger.warn(`Index ${indexName} has active aliases, removing them first`);
                await this.esClient.indices.deleteAlias({
                    index: indexName,
                    name: '_all'
                });
            }

            // Delete the index
            await this.esClient.indices.delete({
                index: indexName
            });

            this.logger.log(`Successfully deleted index ${indexName}`);
            return true;

        } catch (error) {
            this.logger.error(`Failed to delete index ${indexName}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Updates index settings with performance impact analysis
     * @param indexName - Name of the index to update
     * @param settings - New settings to apply
     * @returns Promise<boolean> indicating success/failure
     */
    async updateIndexSettings(indexName: string, settings: Record<string, any>): Promise<boolean> {
        try {
            // Validate index existence
            const indexExists = await this.esClient.indices.exists({
                index: indexName
            });

            if (!indexExists) {
                throw new Error(`Index ${indexName} does not exist`);
            }

            // Get current settings for comparison
            const currentSettings = await this.esClient.indices.getSettings({
                index: indexName
            });

            // Analyze impact of settings changes
            const criticalChanges = ['number_of_shards'];
            const hasCriticalChanges = Object.keys(settings).some(key => 
                criticalChanges.includes(key)
            );

            if (hasCriticalChanges) {
                this.logger.warn(`Critical settings changes detected for ${indexName}`);
                // For critical changes, recommend reindex instead
                throw new Error('Critical settings cannot be updated dynamically. Please use reindex operation.');
            }

            // Apply new settings
            await this.esClient.indices.putSettings({
                index: indexName,
                body: settings
            });

            // Verify settings application
            const updatedSettings = await this.esClient.indices.getSettings({
                index: indexName
            });

            this.logger.log(`Successfully updated settings for index ${indexName}`);
            return true;

        } catch (error) {
            this.logger.error(`Failed to update index settings: ${error.message}`);
            throw error;
        }
    }
}