import { expect } from 'chai';
import { describe, it, before, after } from 'mocha';
import { TestUtils } from '../utils/test-utils';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

describe('Security System Tests', () => {
  let app: INestApplication;
  let httpRequest: any;

  before(async () => {
    app = await TestUtils.createApp();
    httpRequest = TestUtils.createRequest(app);
  });

  after(async () => {
    await TestUtils.closeApp(app);
  });

  describe('URL Security Validation', () => {
    describe('Protocol Validation', () => {
      it('should reject FTP protocol', async () => {
        const response = await httpRequest
          .post('/v1/url-fetches')
          .send({ urls: ['ftp://example.com'] })
          .expect(400);

        expect(response.body.message).to.include('security validation');
        expect(response.body.invalidUrls[0].error).to.include('Protocol');
        expect(response.body.invalidUrls[0].error).to.include('ftp:');
      });

      it('should reject file protocol', async () => {
        const response = await httpRequest
          .post('/v1/url-fetches')
          .send({ urls: ['file:///path/to/file'] })
          .expect(400);

        expect(response.body.message).to.include('security validation');
        expect(response.body.invalidUrls[0].error).to.include('Protocol');
        expect(response.body.invalidUrls[0].error).to.include('file:');
      });

      it('should accept HTTP protocol', async () => {
        const response = await httpRequest
          .post('/v1/url-fetches')
          .send({ urls: ['http://httpbin.org/status/200'] })
          .expect(201);

        expect(response.body.message).to.include('Successfully fetched');
        expect(response.body.count).to.equal(1);
      });

      it('should accept HTTPS protocol', async () => {
        const response = await httpRequest
          .post('/v1/url-fetches')
          .send({ urls: ['https://httpbin.org/status/200'] })
          .expect(201);

        expect(response.body.message).to.include('Successfully fetched');
        expect(response.body.count).to.equal(1);
      });
    });

    describe('Hostname Validation', () => {
      it('should reject localhost', async () => {
        const response = await httpRequest
          .post('/v1/url-fetches')
          .send({ urls: ['http://localhost'] })
          .expect(400);

        expect(response.body.message).to.include('security validation');
        expect(response.body.invalidUrls[0].error).to.include('localhost');
      });

      it('should reject 127.0.0.1', async () => {
        const response = await httpRequest
          .post('/v1/url-fetches')
          .send({ urls: ['http://127.0.0.1'] })
          .expect(400);

        expect(response.body.message).to.include('security validation');
        expect(response.body.invalidUrls[0].error).to.include('127.0.0.1');
      });

      it('should reject private IP ranges', async () => {
        const privateIPs = [
          'http://192.168.1.1',
          'http://10.0.0.1',
          'http://172.16.0.1',
          'http://172.20.0.1',
          'http://172.31.0.1'
        ];

        for (const ip of privateIPs) {
          const response = await httpRequest
            .post('/v1/url-fetches')
            .send({ urls: [ip] })
            .expect(400);

          expect(response.body.message).to.include('security validation');
          expect(response.body.invalidUrls[0].error).to.include('Private');
        }
      });

      it('should reject cloud metadata servers', async () => {
        const response = await httpRequest
          .post('/v1/url-fetches')
          .send({ urls: ['http://169.254.169.254'] })
          .expect(400);

        expect(response.body.message).to.include('security validation');
        expect(response.body.invalidUrls[0].error).to.include('169.254.169.254');
      });
    });

    describe('Suspicious Characters', () => {
      it('should reject URLs with % character', async () => {
        const response = await httpRequest
          .post('/v1/url-fetches')
          .send({ urls: ['http://example%test.com'] })
          .expect(400);

        expect(response.body.message).to.include('security validation');
        expect(response.body.invalidUrls[0].error).to.include('suspicious characters');
      });

      it('should reject URLs with @ character', async () => {
        const response = await httpRequest
          .post('/v1/url-fetches')
          .send({ urls: ['http://example@test.com'] })
          .expect(400);

        expect(response.body.message).to.include('security validation');
        expect(response.body.invalidUrls[0].error).to.include('suspicious characters');
      });

      it('should reject URLs with \\ character', async () => {
        const response = await httpRequest
          .post('/v1/url-fetches')
          .send({ urls: ['http://example\\test.com'] })
          .expect(400);

        expect(response.body.message).to.include('security validation');
        expect(response.body.invalidUrls[0].error).to.include('suspicious characters');
      });
    });

    describe('URL Format Validation', () => {
      it('should reject malformed URLs', async () => {
        const response = await httpRequest
          .post('/v1/url-fetches')
          .send({ urls: ['not-a-url'] })
          .expect(400);

        expect(response.body.message).to.include('security validation');
        expect(response.body.invalidUrls[0].error).to.include('Invalid URL format');
      });

      it('should reject empty URLs', async () => {
        const response = await httpRequest
          .post('/v1/url-fetches')
          .send({ urls: [''] })
          .expect(400);

        expect(response.body.message).to.include('security validation');
        expect(response.body.invalidUrls[0].error).to.include('Invalid URL format');
      });
    });
  });

  describe('Mixed Security Validation', () => {
    it('should reject entire request when any URL is invalid', async () => {
      const response = await httpRequest
        .post('/v1/url-fetches')
        .send({
          urls: [
            'https://httpbin.org/status/200',
            'http://localhost',
            'https://httpbin.org/json'
          ]
        })
        .expect(400);

      expect(response.body.message).to.include('security validation');
      expect(response.body.invalidUrls).to.have.length(1);
      expect(response.body.validUrlsCount).to.equal(2);
      expect(response.body.invalidUrlsCount).to.equal(1);
    });

    it('should provide detailed error information for each invalid URL', async () => {
      const response = await httpRequest
        .post('/v1/url-fetches')
        .send({
          urls: [
            'ftp://example.com',
            'http://localhost',
            'http://192.168.1.1'
          ]
        })
        .expect(400);

      expect(response.body.message).to.include('security validation');
      expect(response.body.invalidUrls).to.have.length(3);
      expect(response.body.validUrlsCount).to.equal(0);
      expect(response.body.invalidUrlsCount).to.equal(3);

      // Check that each invalid URL has a specific error
      const errors = response.body.invalidUrls.map((item: { error: string }) => item.error);
      expect(errors.some((error: string) => error.includes('Protocol'))).to.be.true;
      expect(errors.some((error: string) => error.includes('localhost'))).to.be.true;
      expect(errors.some((error: string) => error.includes('Private'))).to.be.true;
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize response data before storage', async () => {
      const response = await httpRequest
        .post('/v1/url-fetches')
        .send({
          urls: ['https://httpbin.org/json']
        })
        .expect(201);

      expect(response.body.message).to.include('Successfully fetched');
      expect(response.body.data).to.have.length(1);

      const result = response.body.data[0];
      
      // Check that response uses snake_case format
      expect(result).to.have.property('response_status');
      expect(result).to.have.property('response_headers');
      expect(result).to.have.property('response_body');
      expect(result).to.have.property('content_type');
      expect(result).to.have.property('fetched_at');

      // Check that data is properly sanitized (no control characters)
      if (result.response_body) {
        expect(result.response_body).to.not.include('\x00');
        expect(result.response_body).to.not.include('\x01');
        expect(result.response_body).to.not.include('\x02');
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for security violations', async () => {
      const response = await httpRequest
        .post('/v1/url-fetches')
        .send({ urls: ['http://localhost'] })
        .expect(400);

      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('invalidUrls');
    });

    it('should provide detailed error messages', async () => {
      const response = await httpRequest
        .post('/v1/url-fetches')
        .send({ urls: ['ftp://example.com'] })
        .expect(400);

      expect(response.body.message).to.include('Some URLs failed security validation');
      expect(response.body.invalidUrls[0]).to.have.property('url');
      expect(response.body.invalidUrls[0]).to.have.property('error');
    });
  });
}); 