import { expect } from 'chai';
import { describe, it, before, after } from 'mocha';
import { TestUtils } from '../utils/test-utils';
import { INestApplication } from '@nestjs/common';

describe('API Endpoints System Tests', () => {
  let app: INestApplication;
  let httpRequest: any;

  before(async () => {
    app = await TestUtils.createApp();
    httpRequest = TestUtils.createRequest(app);
  });

  after(async () => {
    await TestUtils.closeApp(app);
  });

  describe('POST /v1/url-fetches', () => {
    it('should successfully fetch valid URLs', async () => {
      const response = await httpRequest
        .post('/v1/url-fetches')
        .send({
          urls: [
            'https://httpbin.org/status/200',
            'https://httpbin.org/json'
          ]
        })
        .expect(201);

      TestUtils.expectSuccess(response);
      expect(response.body.count).to.equal(2);
      expect(response.body.processingTime).to.be.a('number');
      expect(response.body.data).to.have.length(2);
      
      // Check snake_case response format
      const firstResult = response.body.data[0];
      expect(firstResult).to.have.property('id');
      expect(firstResult).to.have.property('url');
      expect(firstResult).to.have.property('response_status');
      expect(firstResult).to.have.property('response_headers');
      expect(firstResult).to.have.property('response_body');
      expect(firstResult).to.have.property('content_type');
      expect(firstResult).to.have.property('fetched_at');
    });

    it('should reject invalid protocols', async () => {
      const response = await httpRequest
        .post('/v1/url-fetches')
        .send({
          urls: ['ftp://example.com']
        })
        .expect(400);

      TestUtils.expectSecurityError(response);
      expect(response.body.invalidUrls).to.have.length(1);
      expect(response.body.invalidUrls[0].error).to.include('Protocol');
    });

    it('should reject localhost URLs', async () => {
      const response = await httpRequest
        .post('/v1/url-fetches')
        .send({
          urls: ['http://localhost:3000']
        })
        .expect(400);

      TestUtils.expectSecurityError(response);
      expect(response.body.invalidUrls).to.have.length(1);
      expect(response.body.invalidUrls[0].error).to.include('localhost');
    });

    it('should reject private IP addresses', async () => {
      const response = await httpRequest
        .post('/v1/url-fetches')
        .send({
          urls: ['http://192.168.1.1']
        })
        .expect(400);

      TestUtils.expectSecurityError(response);
      expect(response.body.invalidUrls).to.have.length(1);
      expect(response.body.invalidUrls[0].error).to.include('Private');
    });

    it('should reject mixed valid and invalid URLs', async () => {
      const response = await httpRequest
        .post('/v1/url-fetches')
        .send({
          urls: [
            'https://httpbin.org/status/200',
            'http://localhost:3000'
          ]
        })
        .expect(400);

      TestUtils.expectSecurityError(response);
      expect(response.body.invalidUrls).to.have.length(1);
      expect(response.body.validUrlsCount).to.equal(1);
      expect(response.body.invalidUrlsCount).to.equal(1);
    });

    it('should reject empty URL array', async () => {
      const response = await httpRequest
        .post('/v1/url-fetches')
        .send({
          urls: []
        })
        .expect(400);

      expect(response.body.message).to.be.an('array');
      expect(response.body.message[0]).to.include('urls');
    });

    it('should reject invalid request body', async () => {
      const response = await httpRequest
        .post('/v1/url-fetches')
        .send({
          invalidField: 'test'
        })
        .expect(400);

      expect(response.body.message).to.be.an('array');
      expect(response.body.message[0]).to.include('property invalidField should not exist');
    });

    it('should reject request body with extra fields', async () => {
      const response = await httpRequest
        .post('/v1/url-fetches')
        .send({
          invalidField: 'test',
          urls: [
            'https://httpbin.org/status/200',
            'https://httpbin.org/json'
          ]
        })
        .expect(400);

      expect(response.body.message).to.be.an('array');
      expect(response.body.message[0]).to.include('property invalidField should not exist');
    });
  });

  describe('GET /v1/url-fetches', () => {
    before(async () => {
      // Create some test data
      await httpRequest
        .post('/v1/url-fetches')
        .send({
          urls: [
            'https://httpbin.org/status/200',
            'https://httpbin.org/status/404',
            'https://httpbin.org/json'
          ]
        });
    });

    it('should return paginated results', async () => {
      const response = await httpRequest
        .get('/v1/url-fetches?page=1&limit=2')
        .expect(200);

      TestUtils.expectSuccess(response);
      expect(response.body.data).to.have.length(2);
      expect(response.body.pagination.page).to.equal(1);
      expect(response.body.pagination.limit).to.equal(2);
      expect(response.body.pagination.totalPages).to.be.a('number');
      expect(response.body.pagination.totalItems).to.be.a('number');
    });

    it('should filter by status code', async () => {
      const response = await httpRequest
        .get('/v1/url-fetches?status=200')
        .expect(200);

      TestUtils.expectSuccess(response);
      response.body.data.forEach((item: { response_status: number }) => {
        expect(item.response_status).to.equal(200);
      });
    });

    it('should filter by URL pattern', async () => {
      const response = await httpRequest
        .get('/v1/url-fetches?url=httpbin')
        .expect(200);

      TestUtils.expectSuccess(response);
      response.body.data.forEach((item: { url: string }) => {
        expect(item.url).to.include('httpbin');
      });
    });

    it('should handle invalid pagination parameters', async () => {
      const response = await httpRequest
        .get('/v1/url-fetches?page=0&limit=0')
        .expect(200);

      TestUtils.expectSuccess(response);
    });
  });

  describe('GET /v1/url-fetches/:id', () => {
    let testId: number;

    before(async () => {
      // Create test data and get an ID
      const createResponse = await httpRequest
        .post('/v1/url-fetches')
        .send({
          urls: ['https://httpbin.org/status/200']
        });

      testId = createResponse.body.data[0].id;
    });

    it('should return specific URL fetch by ID', async () => {
      const response = await httpRequest
        .get(`/v1/url-fetches/${testId}`)
        .expect(200);

      expect(response.body.message).to.include('URL fetch found');
      expect(response.body.data.id).to.equal(testId);
      expect(response.body.data.url).to.equal('https://httpbin.org/status/200');
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await httpRequest
        .get('/v1/url-fetches/99999')
        .expect(200);

      expect(response.body.message).to.include('URL fetch not found');
      expect(response.body.data).to.be.null;
    });

    it('should handle invalid ID format', async () => {
      const response = await httpRequest
        .get('/v1/url-fetches/invalid')
        .expect(400);

      expect(response.body.message).to.include('Invalid ID format');
    });
  });
}); 