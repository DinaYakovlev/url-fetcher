import { Injectable, Logger } from '@nestjs/common';
import * as promClient from 'prom-client';



@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  // Prometheus metrics
  private readonly httpRequestDuration: promClient.Histogram;
  private readonly httpRequestTotal: promClient.Counter;
  private readonly dbQueryDuration: promClient.Histogram;
  private readonly dbQueryTotal: promClient.Counter;

  // Custom metrics for min/max tracking
  private httpMinResponseTime = Infinity;
  private httpMaxResponseTime = 0;
  private dbMinQueryTime = Infinity;
  private dbMaxQueryTime = 0;

  constructor() {
    // Initialize Prometheus metrics with try-catch to handle duplicate registration
    try {
      this.httpRequestDuration = new promClient.Histogram({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'url', 'status'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      });
    } catch (error) {
      this.httpRequestDuration = promClient.register.getSingleMetric('http_request_duration_seconds') as promClient.Histogram;
    }

    try {
      this.httpRequestTotal = new promClient.Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'url', 'status'],
      });
    } catch (error) {
      this.httpRequestTotal = promClient.register.getSingleMetric('http_requests_total') as promClient.Counter;
    }

    try {
      this.dbQueryDuration = new promClient.Histogram({
        name: 'database_query_duration_seconds',
        help: 'Duration of database queries in seconds',
        labelNames: ['operation'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      });
    } catch (error) {
      this.dbQueryDuration = promClient.register.getSingleMetric('database_query_duration_seconds') as promClient.Histogram;
    }

    try {
      this.dbQueryTotal = new promClient.Counter({
        name: 'database_queries_total',
        help: 'Total number of database queries',
        labelNames: ['operation'],
      });
    } catch (error) {
      this.dbQueryTotal = promClient.register.getSingleMetric('database_queries_total') as promClient.Counter;
    }
  }

  recordHttpRequest(responseTime: number, status: number): void {
    const durationSeconds = responseTime / 1000;
    
    this.httpRequestDuration.observe({ method: 'GET', status }, durationSeconds);
    this.httpRequestTotal.inc({ method: 'GET', status });

    this.httpMinResponseTime = Math.min(this.httpMinResponseTime, responseTime);
    this.httpMaxResponseTime = Math.max(this.httpMaxResponseTime, responseTime);    
  }

  recordDatabaseQuery(queryTime: number, operation: string): void {
    const durationSeconds = queryTime / 1000;
    
    // Record Prometheus metrics
    this.dbQueryDuration.observe({ operation }, durationSeconds);
    this.dbQueryTotal.inc({ operation });
    
    // Track min/max for custom metrics
    this.dbMinQueryTime = Math.min(this.dbMinQueryTime, queryTime);
    this.dbMaxQueryTime = Math.max(this.dbMaxQueryTime, queryTime);
    
    this.logger.debug(`Database query recorded: ${queryTime}ms for operation: ${operation}`);
  }

  async getMetrics(): Promise<string> {
    return await promClient.register.metrics();
  }


} 