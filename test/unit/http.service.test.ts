import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { HttpService } from '../../src/integrations/http/http.service';
import { MetricsService } from '../../src/metrics/metrics.service';
import * as sinon from 'sinon';
import axios from 'axios';

describe('HttpService', () => {
  let httpService: HttpService;
  let metricsService: sinon.SinonStubbedInstance<MetricsService>;
  let axiosStub: sinon.SinonStub;

  beforeEach(() => {
    metricsService = sinon.createStubInstance(MetricsService);
    httpService = new HttpService(metricsService as any);
    axiosStub = sinon.stub(axios, 'get');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('fetchUrl', () => {
    it('should successfully fetch a URL', async () => {
      const mockResponse = {
        status: 200,
        headers: { 'content-type': 'text/html' },
        data: '<html>Test content</html>'
      };

      axiosStub.resolves(mockResponse);

      const result = await httpService.fetchUrl('https://example.com');

      expect(result.url).to.equal('https://example.com');
      expect(result.responseStatus).to.equal(200);
      expect(result.responseHeaders).to.deep.equal({ 'content-type': 'text/html' });
      expect(result.responseBody).to.equal('<html>Test content</html>');
      expect(result.contentType).to.equal('text/html');
      expect(result.error).to.be.undefined;

      expect(axiosStub.calledOnce).to.be.true;
      expect(axiosStub.firstCall.args[0]).to.equal('https://example.com');
    });

    it('should handle non-2xx status codes', async () => {
      const mockResponse = {
        status: 404,
        headers: { 'content-type': 'text/html' },
        data: 'Not Found'
      };

      axiosStub.resolves(mockResponse);

      const result = await httpService.fetchUrl('https://example.com/not-found');

      expect(result.url).to.equal('https://example.com/not-found');
      expect(result.responseStatus).to.equal(404);
      expect(result.responseHeaders).to.deep.equal({ 'content-type': 'text/html' });
      expect(result.responseBody).to.equal('Not Found');
      expect(result.error).to.be.undefined;
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      axiosStub.rejects(networkError);

      const result = await httpService.fetchUrl('https://invalid-domain-12345.com');

      expect(result.url).to.equal('https://invalid-domain-12345.com');
      expect(result.responseStatus).to.be.undefined;
      expect(result.error).to.equal('Network Error');
    });

    it('should handle HTTP errors with response', async () => {
      const httpError = {
        response: {
          status: 500,
          data: 'Internal Server Error'
        },
        message: 'Request failed with status code 500'
      };
      axiosStub.rejects(httpError);

      const result = await httpService.fetchUrl('https://example.com/error');

      expect(result.url).to.equal('https://example.com/error');
      expect(result.responseStatus).to.equal(500);
      expect(result.error).to.equal('HTTP 500: Request failed with status code 500');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 5000ms exceeded');
      axiosStub.rejects(timeoutError);

      const result = await httpService.fetchUrl('https://slow-site.com');

      expect(result.url).to.equal('https://slow-site.com');
      expect(result.responseStatus).to.be.undefined;
      expect(result.error).to.equal('timeout of 5000ms exceeded');
    });

    it('should use correct axios configuration', async () => {
      const mockResponse = {
        status: 200,
        headers: {},
        data: 'Success'
      };

      axiosStub.resolves(mockResponse);

      await httpService.fetchUrl('https://example.com');

      const axiosConfig = axiosStub.firstCall.args[1];
      expect(axiosConfig.timeout).to.equal(5000);
      expect(axiosConfig.maxRedirects).to.equal(3);
      expect(axiosConfig.headers['User-Agent']).to.equal('URL-Fetcher-Service/1.0');
      expect(axiosConfig.validateStatus).to.be.a('function');
    });

    it('should validate status function accepts all status codes', async () => {
      const mockResponse = {
        status: 200,
        headers: {},
        data: 'Success'
      };

      axiosStub.resolves(mockResponse);

      await httpService.fetchUrl('https://example.com');

      const axiosConfig = axiosStub.firstCall.args[1];
      const validateStatus = axiosConfig.validateStatus;

      // Should return true for all status codes
      expect(validateStatus(200)).to.be.true;
      expect(validateStatus(404)).to.be.true;
      expect(validateStatus(500)).to.be.true;
    });
  });
}); 