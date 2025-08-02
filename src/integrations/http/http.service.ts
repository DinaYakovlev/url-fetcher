import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse, AxiosError } from 'axios';
import { MetricsService } from '../../metrics/metrics.service';

export interface FetchResult {
  url: string;
  responseStatus?: number;
  responseHeaders?: Record<string, unknown>;
  responseBody?: string;
  contentType?: string;
  error?: string;
}

@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);

  constructor(private readonly metricsService: MetricsService) {}

  async fetchUrl(url: string): Promise<FetchResult> {
    const startTime = Date.now();
    
    try {
      const response: AxiosResponse = await axios.get(url, {
        timeout: 5000,
        maxRedirects: 3,
        headers: {
          'User-Agent': 'URL-Fetcher-Service/1.0',
        },
        validateStatus: () => true,
      });

      const responseTime = Date.now() - startTime;
      this.metricsService.recordHttpRequest(responseTime, response.status);

      return {
        url,
        responseStatus: response.status,
        responseHeaders: response.headers,
        responseBody: response.data,
        contentType: response.headers['content-type'],
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.metricsService.recordHttpRequest(responseTime, error.response?.status || 0);
      
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response 
        ? `HTTP ${axiosError.response.status}: ${axiosError.message}`
        : axiosError.message;

      this.logger.error(`Failed to fetch ${url}: ${errorMessage}`);

      return {
        url,
        responseStatus: axiosError.response?.status,
        error: errorMessage,
      };
    }
  }

  async fetchMultipleUrls(urls: string[]): Promise<FetchResult[]> {
    const promises = urls.map(url => this.fetchUrl(url));
    return Promise.all(promises);
  }
} 