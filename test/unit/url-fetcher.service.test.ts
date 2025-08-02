import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { UrlFetcherService } from '../../src/url-fetcher/url-fetcher.service';
import { HttpService } from '../../src/integrations/http/http.service';
import { PostgresService } from '../../src/integrations/postgres/postgres.service';
import { SecurityService } from '../../src/integrations/security/security.service';
import { CreateUrlFetchDto } from '../../src/url-fetcher/dto/create-url-fetch.dto';
import { UrlFetch } from '../../src/url-fetcher/entities/url-fetch.entity';
import * as sinon from 'sinon';
import { BadRequestException } from '@nestjs/common';

describe('UrlFetcherService', () => {
  let urlFetcherService: UrlFetcherService;
  let httpService: sinon.SinonStubbedInstance<HttpService>;
  let postgresService: sinon.SinonStubbedInstance<PostgresService>;
  let securityService: sinon.SinonStubbedInstance<SecurityService>;

  beforeEach(() => {
    httpService = sinon.createStubInstance(HttpService);
    postgresService = sinon.createStubInstance(PostgresService);
    securityService = sinon.createStubInstance(SecurityService);

    urlFetcherService = new UrlFetcherService(
      httpService as any,
      postgresService as any,
      securityService as any
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('fetchUrls', () => {
    it('should successfully fetch and save URLs', async () => {
      const dto: CreateUrlFetchDto = {
        urls: ['https://example.com', 'https://httpbin.org']
      };

      const mockFetchResults = [
        {
          url: 'https://example.com',
          responseStatus: 200,
          responseHeaders: { 'content-type': 'text/html' },
          responseBody: '<html>Test</html>',
          contentType: 'text/html'
        },
        {
          url: 'https://httpbin.org',
          responseStatus: 200,
          responseHeaders: { 'content-type': 'application/json' },
          responseBody: '{"test": true}',
          contentType: 'application/json'
        }
      ];

      const mockSavedResults = [
        {
          id: 1,
          url: 'https://example.com',
          response_status: 200,
          response_headers: { 'content-type': 'text/html' },
          response_body: '<html>Test</html>',
          content_type: 'text/html',
          fetched_at: new Date()
        },
        {
          id: 2,
          url: 'https://httpbin.org',
          response_status: 200,
          response_headers: { 'content-type': 'application/json' },
          response_body: '{"test": true}',
          content_type: 'application/json',
          fetched_at: new Date()
        }
      ];

      securityService.validateUrls.returns({
        validUrls: ['https://example.com', 'https://httpbin.org'],
        invalidUrls: []
      });

      httpService.fetchUrl.onFirstCall().resolves(mockFetchResults[0]);
      httpService.fetchUrl.onSecondCall().resolves(mockFetchResults[1]);

      postgresService.saveFetchResults.resolves(mockSavedResults);

      const result = await urlFetcherService.fetchUrls(dto);

      expect(result).to.deep.equal(mockSavedResults);
      expect(securityService.validateUrls.calledOnceWith(dto.urls)).to.be.true;
      expect(httpService.fetchUrl.calledTwice).to.be.true;
      expect(postgresService.saveFetchResults.calledOnce).to.be.true;
    });

    it('should throw BadRequestException when URLs fail security validation', async () => {
      const dto: CreateUrlFetchDto = {
        urls: ['http://localhost', 'https://example.com']
      };

      securityService.validateUrls.returns({
        validUrls: ['https://example.com'],
        invalidUrls: [{ url: 'http://localhost', error: 'Hostname localhost is not allowed' }]
      });

      try {
        await urlFetcherService.fetchUrls(dto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.include('Some URLs failed security validation');
        expect(error.response.invalidUrls).to.have.length(1);
        expect(error.response.validUrlsCount).to.equal(1);
        expect(error.response.invalidUrlsCount).to.equal(1);
      }

      expect(httpService.fetchUrl.called).to.be.false;
      expect(postgresService.saveFetchResults.called).to.be.false;
    });

    it('should throw BadRequestException when no valid URLs provided', async () => {
      const dto: CreateUrlFetchDto = {
        urls: ['http://localhost', 'ftp://example.com']
      };

      securityService.validateUrls.returns({
        validUrls: [],
        invalidUrls: [
          { url: 'http://localhost', error: 'Hostname localhost is not allowed' },
          { url: 'ftp://example.com', error: 'Protocol ftp: is not allowed' }
        ]
      });

      try {
        await urlFetcherService.fetchUrls(dto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.equal('Some URLs failed security validation');
      }
    });

    it('should handle individual URL fetch failures gracefully', async () => {
      const dto: CreateUrlFetchDto = {
        urls: ['https://example.com', 'https://invalid-site.com']
      };

      const mockFetchResults = [
        {
          url: 'https://example.com',
          responseStatus: 200,
          responseHeaders: { 'content-type': 'text/html' },
          responseBody: '<html>Test</html>',
          contentType: 'text/html'
        },
        {
          url: 'https://invalid-site.com',
          error: 'Network Error'
        }
      ];

      const mockSavedResults = [
        {
          id: 1,
          url: 'https://example.com',
          response_status: 200,
          response_headers: { 'content-type': 'text/html' },
          response_body: '<html>Test</html>',
          content_type: 'text/html',
          fetched_at: new Date()
        }
      ];

      securityService.validateUrls.returns({
        validUrls: ['https://example.com', 'https://invalid-site.com'],
        invalidUrls: []
      });

      httpService.fetchUrl.onFirstCall().resolves(mockFetchResults[0]);
      httpService.fetchUrl.onSecondCall().resolves(mockFetchResults[1]);

      postgresService.saveFetchResults.resolves(mockSavedResults);

      const result = await urlFetcherService.fetchUrls(dto);

      expect(result).to.deep.equal(mockSavedResults);
      expect(postgresService.saveFetchResults.calledOnce).to.be.true;
    });

    it('should sanitize data before saving', async () => {
      const dto: CreateUrlFetchDto = {
        urls: ['https://example.com']
      };

      const mockFetchResult = {
        url: 'https://example.com',
        responseStatus: 200,
        responseHeaders: { 'content-type': 'text/html\x00' },
        responseBody: '<html>Test\x01content</html>',
        contentType: 'text/html\x02'
      };

      const expectedSanitizedResult = {
        url: 'https://example.com',
        responseStatus: 200,
        responseHeaders: { 'content-type': 'text/html ' },
        responseBody: '<html>Test content</html>',
        contentType: 'text/html '
      };

      securityService.validateUrls.returns({
        validUrls: ['https://example.com'],
        invalidUrls: []
      });

      httpService.fetchUrl.resolves(mockFetchResult);
      postgresService.saveFetchResults.resolves([]);

      await urlFetcherService.fetchUrls(dto);

      expect(securityService.sanitizeData.calledThrice).to.be.true;
      expect(postgresService.saveFetchResults.calledOnce).to.be.true;
    });

    it('should handle duplicate URLs with upsert', async () => {
      const dto: CreateUrlFetchDto = {
        urls: ['https://example.com', 'https://example.com'] // Duplicate URL
      };

      const mockFetchResult = {
        url: 'https://example.com',
        responseStatus: 200,
        responseHeaders: { 'content-type': 'text/html' },
        responseBody: '<html>Test</html>',
        contentType: 'text/html'
      };

      const mockSavedResult = {
        id: 1,
        url: 'https://example.com',
        response_status: 200,
        response_headers: { 'content-type': 'text/html' },
        response_body: '<html>Test</html>',
        content_type: 'text/html',
        fetched_at: new Date()
      };

      securityService.validateUrls.returns({
        validUrls: ['https://example.com', 'https://example.com'],
        invalidUrls: []
      });

      httpService.fetchUrl.resolves(mockFetchResult);
      postgresService.saveFetchResults.resolves([mockSavedResult]);

      const result = await urlFetcherService.fetchUrls(dto);

      expect(result).to.have.length(1); // Should only return one result due to upsert
      expect(result[0].url).to.equal('https://example.com');
      expect(postgresService.saveFetchResults.calledOnce).to.be.true;
    });
  });

  describe('getUrlFetchesWithPagination', () => {
    it('should delegate to postgres service', async () => {
      const options = {
        page: 1,
        limit: 10,
        status: 200,
        url: 'example.com'
      };

      const expectedResult = {
        data: [],
        page: 1,
        limit: 10,
        totalPages: 0,
        totalItems: 0
      };

      postgresService.getUrlFetchesWithPagination.resolves(expectedResult);

      const result = await urlFetcherService.getUrlFetchesWithPagination(options);

      expect(result).to.deep.equal(expectedResult);
      expect(postgresService.getUrlFetchesWithPagination.calledOnceWith(options)).to.be.true;
    });
  });

  describe('getUrlFetchById', () => {
    it('should delegate to postgres service', async () => {
      const id = 1;
      const expectedResult = {
        id: 1,
        url: 'https://example.com',
        responseStatus: 200,
        responseHeaders: {},
        responseBody: 'test',
        contentType: 'text/html',
        fetchedAt: new Date(),
        toJSON: () => ({
          id: 1,
          url: 'https://example.com',
          response_status: 200,
          response_headers: {},
          response_body: 'test',
          content_type: 'text/html',
          fetched_at: new Date()
        })
      };

      postgresService.getUrlFetchById.resolves(expectedResult);

      const result = await urlFetcherService.getUrlFetchById(id);

      expect(result).to.deep.equal(expectedResult);
      expect(postgresService.getUrlFetchById.calledOnceWith(id)).to.be.true;
    });
  });


}); 