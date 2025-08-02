import { Controller, Post, Get, Body, HttpStatus, HttpCode, Param, Query, BadRequestException } from '@nestjs/common';
import { UrlFetcherService } from './url-fetcher.service';
import { CreateUrlFetchDto } from './dto/create-url-fetch.dto';
import { UrlFetch } from './entities/url-fetch.entity';

export interface PaginationQuery {
  page?: string;
  limit?: string;
  status?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedResponse<T> {
  message: string;
  data: T[];
  count: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
}

@Controller('url-fetches')
export class UrlFetcherController {
  constructor(private readonly urlFetcherService: UrlFetcherService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUrlFetches(@Body() createUrlFetchDto: CreateUrlFetchDto): Promise<{
    message: string;
    data: UrlFetch[];
    count: number;
    processingTime: number;
  }> {
    const startTime = Date.now();
    const results = await this.urlFetcherService.fetchUrls(createUrlFetchDto);
    const processingTime = Date.now() - startTime;
    
    return {
      message: `Successfully fetched ${results.length} URLs`,
      data: results,
      count: results.length,
      processingTime,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllUrlFetches(@Query() query: PaginationQuery): Promise<PaginatedResponse<UrlFetch>> {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const status = query.status ? parseInt(query.status) : undefined;
    const url = query.url;
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const results = await this.urlFetcherService.getUrlFetchesWithPagination({
      page,
      limit,
      status,
      url,
      startDate,
      endDate,
    });
    
    return {
      message: 'Successfully retrieved URL fetches',
      data: results.data,
      count: results.data.length,
      pagination: {
        page: results.page,
        limit: results.limit,
        totalPages: results.totalPages,
        totalItems: results.totalItems,
      },
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getUrlFetchById(@Param('id') id: string): Promise<{
    message: string;
    data: UrlFetch | null;
  }> {
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      throw new BadRequestException('Invalid ID format. ID must be a valid integer.');
    }
    
    const result = await this.urlFetcherService.getUrlFetchById(parsedId);
    
    return {
      message: result ? 'URL fetch found' : 'URL fetch not found',
      data: result,
    };
  }
} 