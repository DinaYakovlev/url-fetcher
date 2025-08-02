import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: {
    status: 'connected' | 'disconnected';
    responseTime?: number;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly dataSource: DataSource) {}

  async checkHealth(): Promise<HealthStatus> {
    const startTime = Date.now();
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    let responseTime: number | undefined;

    try {
      // Check database connection
      await this.dataSource.query('SELECT 1');
      dbStatus = 'connected';
      responseTime = Date.now() - startTime;
      this.logger.debug(`Health check passed - Database response time: ${responseTime}ms`);
    } catch (error) {
      this.logger.error('Health check failed - Database connection error:', error);
      responseTime = Date.now() - startTime;
    }

    const overallStatus: 'healthy' | 'unhealthy' = dbStatus === 'connected' ? 'healthy' : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        responseTime,
      },
    };
  }
} 