import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { PostgresService } from '../../src/integrations/postgres/postgres.service';
import { Repository, DataSource, QueryFailedError } from 'typeorm';
import { UrlFetch } from '../../src/url-fetcher/entities/url-fetch.entity';
import { ServiceUnavailableException } from '@nestjs/common';
import { MetricsService } from '../../src/metrics/metrics.service';
import * as sinon from 'sinon';

describe('PostgresService', () => {
  let postgresService: PostgresService;
  let urlFetchRepository: sinon.SinonStubbedInstance<Repository<UrlFetch>>;
  let dataSource: sinon.SinonStubbedInstance<DataSource>;
  let metricsService: sinon.SinonStubbedInstance<MetricsService>;

  beforeEach(() => {
    urlFetchRepository = sinon.createStubInstance(Repository);
    dataSource = sinon.createStubInstance(DataSource);
    metricsService = sinon.createStubInstance(MetricsService);

    postgresService = new PostgresService(
      urlFetchRepository as any,
      dataSource as any,
      metricsService as any
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleDatabaseError', () => {
    it('should throw ServiceUnavailableException for connection errors', () => {
      const connectionError = new Error('connection refused') as any;
      connectionError.code = 'ECONNREFUSED';

      try {
        (postgresService as any).handleDatabaseError(connectionError, 'Test context');
        expect.fail('Should have thrown ServiceUnavailableException');
      } catch (error) {
        expect(error).to.be.instanceOf(ServiceUnavailableException);
        expect(error.message).to.equal('Service temporarily unavailable');
      }
    });

    it('should throw ServiceUnavailableException for timeout errors', () => {
      const timeoutError = new Error('connection timeout') as any;
      timeoutError.code = 'ETIMEDOUT';

      try {
        (postgresService as any).handleDatabaseError(timeoutError, 'Test context');
        expect.fail('Should have thrown ServiceUnavailableException');
      } catch (error) {
        expect(error).to.be.instanceOf(ServiceUnavailableException);
        expect(error.message).to.equal('Service temporarily unavailable');
      }
    });

    it('should throw ServiceUnavailableException for deadlock errors', () => {
      const deadlockError = new QueryFailedError('query', [], new Error('deadlock detected'));
      (deadlockError as any).code = '40P01';

      try {
        (postgresService as any).handleDatabaseError(deadlockError, 'Test context');
        expect.fail('Should have thrown ServiceUnavailableException');
      } catch (error) {
        expect(error).to.be.instanceOf(ServiceUnavailableException);
        expect(error.message).to.equal('Service temporarily unavailable');
      }
    });

    it('should throw ServiceUnavailableException for lock errors', () => {
      const lockError = new QueryFailedError('query', [], new Error('lock not available'));
      (lockError as any).code = '55P03';

      try {
        (postgresService as any).handleDatabaseError(lockError, 'Test context');
        expect.fail('Should have thrown ServiceUnavailableException');
      } catch (error) {
        expect(error).to.be.instanceOf(ServiceUnavailableException);
        expect(error.message).to.equal('Service temporarily unavailable');
      }
    });

    it('should throw ServiceUnavailableException for transaction errors', () => {
      const transactionError = new Error('transaction rollback');
      transactionError.message = 'transaction rollback';

      try {
        (postgresService as any).handleDatabaseError(transactionError, 'Test context');
        expect.fail('Should have thrown ServiceUnavailableException');
      } catch (error) {
        expect(error).to.be.instanceOf(ServiceUnavailableException);
        expect(error.message).to.equal('Service temporarily unavailable');
      }
    });

    it('should re-throw non-database errors', () => {
      const validationError = new Error('validation failed');

      try {
        (postgresService as any).handleDatabaseError(validationError, 'Test context');
        expect.fail('Should have re-thrown the original error');
      } catch (error) {
        expect(error).to.equal(validationError);
        expect(error.message).to.equal('validation failed');
      }
    });
  });

  describe('saveFetchResults', () => {
    it('should handle database errors during save', async () => {
             const results = [
         {
           url: 'https://example.com',
           responseStatus: 200,
           responseHeaders: {},
           responseBody: 'test',
           contentType: 'text/html'
         }
       ];

       const databaseError = new QueryFailedError('query', [], new Error('connection failed'));
       (databaseError as any).code = '08006';

      urlFetchRepository.createQueryBuilder.returns({
        insert: sinon.stub().returns({
          into: sinon.stub().returns({
            values: sinon.stub().returns({
              onConflict: sinon.stub().returns({
                returning: sinon.stub().returns({
                  execute: sinon.stub().rejects(databaseError)
                })
              })
            })
          })
        })
      } as any);

      try {
        await postgresService.saveFetchResults(results);
        expect.fail('Should have thrown ServiceUnavailableException');
      } catch (error) {
        expect(error).to.be.instanceOf(ServiceUnavailableException);
        expect(error.message).to.equal('Service temporarily unavailable');
      }
    });
  });

  describe('getUrlFetchesWithPagination', () => {
    it('should handle database errors during pagination query', async () => {
      const options = {
        page: 1,
        limit: 10
      };

      const databaseError = new QueryFailedError('query', [], new Error('connection failed'));
      (databaseError as any).code = '08006';

      dataSource.query.rejects(databaseError);

      try {
        await postgresService.getUrlFetchesWithPagination(options);
        expect.fail('Should have thrown ServiceUnavailableException');
      } catch (error) {
        expect(error).to.be.instanceOf(ServiceUnavailableException);
        expect(error.message).to.equal('Service temporarily unavailable');
      }
    });
  });


}); 