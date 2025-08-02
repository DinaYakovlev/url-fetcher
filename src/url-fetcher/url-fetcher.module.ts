import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UrlFetcherController } from './url-fetcher.controller';
import { UrlFetcherService } from './url-fetcher.service';
import { UrlFetch } from './entities/url-fetch.entity';
import { HttpService } from '../integrations/http/http.service';
import { PostgresService } from '../integrations/postgres/postgres.service';
import { SecurityService } from '../integrations/security/security.service';
import { MetricsService } from '../metrics/metrics.service';

@Module({
  imports: [TypeOrmModule.forFeature([UrlFetch])],
  controllers: [UrlFetcherController],
  providers: [UrlFetcherService, HttpService, PostgresService, SecurityService, MetricsService],
  exports: [UrlFetcherService],
})
export class UrlFetcherModule {} 