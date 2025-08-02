import { Controller, Get, HttpCode, HttpStatus, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain')
  async getMetrics(): Promise<string> {
    return await this.metricsService.getMetrics();
  }


} 