import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError } from 'typeorm';
import { UrlFetch } from '../../url-fetcher/entities/url-fetch.entity';
import { FetchResult } from '../http/http.service';
import { PaginationOptions, PaginatedResult } from '../../url-fetcher/url-fetcher.service';
import { MetricsService } from '../../metrics/metrics.service';

const databaseErrorCodes = [
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '08007', // connection_failure_during_transaction
  '40P01', // deadlock_detected
  '55P03', // lock_not_available
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
];

const connectionErrorCodesNonQuery = [
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'connection',
  'timeout',
];

const connectionErrorMessages = [
  'timeout',
  'connection',
  'deadlock',
  'transaction',
  'lock',
];

@Injectable()
export class PostgresService {
  private readonly logger = new Logger(PostgresService.name);

  constructor(
    @InjectRepository(UrlFetch)
    private urlFetchRepository: Repository<UrlFetch>,
    private dataSource: DataSource,
    private readonly metricsService: MetricsService,
  ) {
    this.initializeDatabase();
  }

  private handleDatabaseError(error: unknown, context: string): never {
    this.logger.error(`${context}:`, error);
    
    if (error instanceof QueryFailedError) {
      const pgError = error as { code?: string };
      const errorCode = pgError.code;

      if (databaseErrorCodes.includes(errorCode)) {
        throw new ServiceUnavailableException('Service temporarily unavailable');
      }
    }
    
    const errorObj = error as { code?: string; message?: string };
    if (connectionErrorCodesNonQuery.includes(errorObj.code) ||
        connectionErrorMessages.some(message => errorObj.message?.includes(message))) {
      throw new ServiceUnavailableException('Service temporarily unavailable');
    }
    
    throw error;
  }

  private async initializeDatabase(): Promise<void> {
    try {
      const tableExists = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'url_fetches'
        );
      `);

      if (!tableExists[0].exists) {
        this.logger.log('Creating url_fetches table...');
        
        await this.dataSource.query(`
          CREATE TABLE url_fetches (
            id SERIAL PRIMARY KEY,
            url TEXT NOT NULL UNIQUE,
            response_status INT,
            response_headers JSONB,
            response_body TEXT,
            content_type TEXT,
            fetched_at TIMESTAMPTZ DEFAULT now()
          );
        `);

        await this.dataSource.query(`
          CREATE INDEX idx_url ON url_fetches (url);
          CREATE INDEX idx_status ON url_fetches (response_status);
          CREATE INDEX idx_fetched_at ON url_fetches (fetched_at DESC);
        `);

        await this.dataSource.query(`
          CREATE EXTENSION IF NOT EXISTS pg_trgm;
          CREATE INDEX idx_url_trgm ON url_fetches USING gin (url gin_trgm_ops);
        `);

        this.logger.log('Database table and indexes created successfully');
      } else {
        this.logger.log('url_fetches table already exists');
      }
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      this.handleDatabaseError(error, 'Database initialization failed');
    }
  }

  async saveFetchResults(results: FetchResult[]): Promise<UrlFetch[]> {
    const startTime = Date.now();
    
    try {
      const savedResults: UrlFetch[] = [];
      
      for (const result of results) {
        // Use upsert to handle duplicate URLs
        const upsertResult = await this.urlFetchRepository
          .createQueryBuilder()
          .insert()
          .into(UrlFetch)
          .values({
            url: result.url,
            responseStatus: result.responseStatus,
            responseHeaders: result.responseHeaders as Record<string, any>,
            responseBody: result.responseBody,
            contentType: result.contentType,
          })
          .onConflict('("url") DO UPDATE SET "response_status" = EXCLUDED."response_status", "response_headers" = EXCLUDED."response_headers", "response_body" = EXCLUDED."response_body", "content_type" = EXCLUDED."content_type", "fetched_at" = now()')
          .returning('*')
          .execute();

        if (upsertResult.raw && upsertResult.raw[0]) {
          const urlFetch = new UrlFetch();
          urlFetch.id = upsertResult.raw[0].id;
          urlFetch.url = upsertResult.raw[0].url;
          urlFetch.responseStatus = upsertResult.raw[0].response_status;
          urlFetch.responseHeaders = upsertResult.raw[0].response_headers;
          urlFetch.responseBody = upsertResult.raw[0].response_body;
          urlFetch.contentType = upsertResult.raw[0].content_type;
          urlFetch.fetchedAt = upsertResult.raw[0].fetched_at;
          savedResults.push(urlFetch);
        }
      }

      const queryTime = Date.now() - startTime;
      this.metricsService.recordDatabaseQuery(queryTime, 'save_fetch_results');

      this.logger.log(`Upserted ${savedResults.length} URL fetch results`);
      
      return savedResults.map(result => result.toJSON() as any);
    } catch (error) {
      const queryTime = Date.now() - startTime;
      this.metricsService.recordDatabaseQuery(queryTime, 'save_fetch_results');
      this.handleDatabaseError(error, 'Failed to save fetch results');
    }
  }

  async getAllUrlFetches(): Promise<UrlFetch[]> {
    try {
      return await this.urlFetchRepository.find({
        order: {
          fetchedAt: 'DESC',
        },
      });
    } catch (error) {
      this.handleDatabaseError(error, 'Failed to retrieve URL fetches');
    }
  }

  async getUrlFetchesWithPagination(options: PaginationOptions): Promise<PaginatedResult<UrlFetch>> {
    const startTime = Date.now();
    
    try {
      const { page, limit, status, url, startDate, endDate } = options;
      const offset = (page - 1) * limit;

      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      if (status !== undefined) {
        whereConditions.push(`response_status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      if (url) {
        whereConditions.push(`url ~ $${paramIndex}`);
        queryParams.push(url);
        paramIndex++;
      }

      if (startDate) {
        whereConditions.push(`fetched_at >= $${paramIndex}`);
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereConditions.push(`fetched_at <= $${paramIndex}`);
        queryParams.push(endDate);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      const countQuery = `
        SELECT COUNT(*) as total 
        FROM url_fetches 
        ${whereClause}
      `;
      const countResult = await this.dataSource.query(countQuery, queryParams);
      const totalItems = parseInt(countResult[0].total);

      const dataQuery = `
        SELECT * FROM url_fetches 
        ${whereClause}
        ORDER BY fetched_at DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      const dataParams = [...queryParams, limit, offset];
      const data = await this.dataSource.query(dataQuery, dataParams);

      const totalPages = Math.ceil(totalItems / limit);

      const queryTime = Date.now() - startTime;
      this.metricsService.recordDatabaseQuery(queryTime, 'get_url_fetches_pagination');

      this.logger.log(`Retrieved ${data.length} items from page ${page} of ${totalPages} (total: ${totalItems})`);

      return {
        data,
        page,
        limit,
        totalPages,
        totalItems,
      };
    } catch (error) {
      const queryTime = Date.now() - startTime;
      this.metricsService.recordDatabaseQuery(queryTime, 'get_url_fetches_pagination');
      this.handleDatabaseError(error, 'Failed to retrieve URL fetches with pagination');
    }
  }

  async getUrlFetchById(id: number): Promise<UrlFetch | null> {
    try {
      const result = await this.urlFetchRepository.findOne({ where: { id } });
      if (!result) {
        return null;
      }
      
      return result.toJSON() as any;
    } catch (error) {
      this.handleDatabaseError(error, `Failed to retrieve URL fetch with id ${id}`);
    }
  }

  async getUrlFetchesByUrl(url: string): Promise<UrlFetch[]> {
    try {
      return await this.urlFetchRepository.find({
        where: { url },
        order: {
          fetchedAt: 'DESC',
        },
      });
    } catch (error) {
      this.handleDatabaseError(error, `Failed to retrieve URL fetches for ${url}`);
    }
  }


} 