import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '../integrations/http/http.service';
import { PostgresService } from '../integrations/postgres/postgres.service';
import { SecurityService } from '../integrations/security/security.service';
import { CreateUrlFetchDto } from './dto/create-url-fetch.dto';
import { UrlFetch } from './entities/url-fetch.entity';

export interface PaginationOptions {
  page: number;
  limit: number;
  status?: number;
  url?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  totalPages: number;
  totalItems: number;
}

@Injectable()
export class UrlFetcherService {
  private readonly logger = new Logger(UrlFetcherService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly postgresService: PostgresService,
    private readonly securityService: SecurityService,
  ) {}

  async fetchUrls(createUrlFetchDto: CreateUrlFetchDto): Promise<UrlFetch[]> {
    this.logger.log(`Starting to fetch ${createUrlFetchDto.urls.length} URLs in parallel`);

    try {
      const { validUrls, invalidUrls } = this.securityService.validateUrls(createUrlFetchDto.urls);

      if (invalidUrls.length > 0) {
        const errorMessage = `Invalid URLs detected: ${invalidUrls.map(item => `${item.url} (${item.error})`).join(', ')}`;
        this.logger.warn(`URL validation failed for some URLs: ${errorMessage}`);
        throw new BadRequestException({
          message: 'Some URLs failed security validation',
          invalidUrls,
          validUrlsCount: validUrls.length,
          invalidUrlsCount: invalidUrls.length,
        });
      }

      if (validUrls.length === 0) {
        throw new BadRequestException('No valid URLs provided after security validation');
      }

      this.logger.log(`Proceeding with ${validUrls.length} validated URLs`);

      const fetchPromises = validUrls.map(async (url) => {
        try {
          const result = await this.httpService.fetchUrl(url);
          this.logger.log(`Successfully fetched: ${url}`);
          return result;
        } catch (error) {
          this.logger.error(`Failed to fetch ${url}:`, error);
          return {
            url,
            error: error.message,
          };
        }
      });

      const fetchResults = await Promise.allSettled(fetchPromises);
      
      const successfulResults = fetchResults
        .map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            this.logger.error(`Promise rejected for URL ${validUrls[index]}:`, result.reason);
            return {
              url: validUrls[index],
              error: result.reason.message,
            };
          }
        })
        .filter(result => result !== null);

      const sanitizedResults = successfulResults.map(result => {
        if ('error' in result) {
          // This is an error result, no sanitization needed
          return result;
        } else {
          // This is a successful result, sanitize the data
          return {
            ...result,
            responseHeaders: this.securityService.sanitizeData(result.responseHeaders) as Record<string, unknown>,
            responseBody: this.securityService.sanitizeData(result.responseBody) as string,
            contentType: this.securityService.sanitizeData(result.contentType) as string,
          };
        }
      });

      const savedResults = await this.postgresService.saveFetchResults(sanitizedResults);

      this.logger.log(`Successfully processed ${savedResults.length} URLs out of ${validUrls.length} validated URLs`);
      return savedResults;
    } catch (error) {
      this.logger.error('Error in fetchUrls:', error);
      
      throw error;
    }
  }

  async getAllUrlFetches(): Promise<UrlFetch[]> {
    this.logger.log('Retrieving all URL fetches');
    return this.postgresService.getAllUrlFetches();
  }

  async getUrlFetchesWithPagination(options: PaginationOptions): Promise<PaginatedResult<UrlFetch>> {
    try {
      this.logger.log(`Retrieving URL fetches with pagination: page=${options.page}, limit=${options.limit}`);
      return await this.postgresService.getUrlFetchesWithPagination(options);
    } catch (error) {
      this.logger.error('Error in getUrlFetchesWithPagination:', error);

      throw error;
    }
  }

  async getUrlFetchById(id: number): Promise<UrlFetch | null> {
    try {
      this.logger.log(`Retrieving URL fetch with id: ${id}`);
      return await this.postgresService.getUrlFetchById(id);
    } catch (error) {
      this.logger.error(`Error in getUrlFetchById for id ${id}:`, error);

      throw error;
    }
  }

  async getUrlFetchesByUrl(url: string): Promise<UrlFetch[]> {
    this.logger.log(`Retrieving URL fetches for: ${url}`);
    return this.postgresService.getUrlFetchesByUrl(url);
  }
}