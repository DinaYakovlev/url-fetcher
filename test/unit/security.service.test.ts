import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { SecurityService } from '../../src/integrations/security/security.service';

describe('SecurityService', () => {
  let securityService: SecurityService;

  beforeEach(() => {
    securityService = new SecurityService();
  });

  describe('validateUrl', () => {
    describe('Valid URLs', () => {
      it('should accept valid HTTP URLs', () => {
        const result = securityService.validateUrl('http://example.com');
        expect(result.isValid).to.be.true;
        expect(result.sanitizedUrl).to.equal('http://example.com/');
      });

      it('should accept valid HTTPS URLs', () => {
        const result = securityService.validateUrl('https://example.com');
        expect(result.isValid).to.be.true;
        expect(result.sanitizedUrl).to.equal('https://example.com/');
      });

      it('should accept URLs with paths', () => {
        const result = securityService.validateUrl('https://example.com/path');
        expect(result.isValid).to.be.true;
        expect(result.sanitizedUrl).to.equal('https://example.com/path');
      });

      it('should accept URLs with query parameters', () => {
        const result = securityService.validateUrl('https://example.com?param=value');
        expect(result.isValid).to.be.true;
        expect(result.sanitizedUrl).to.equal('https://example.com/?param=value');
      });
    });

    describe('Protocol Validation', () => {
      it('should reject FTP URLs', () => {
        const result = securityService.validateUrl('ftp://example.com');
        expect(result.isValid).to.be.false;
        expect(result.error).to.include('Protocol');
        expect(result.error).to.include('ftp:');
      });

      it('should reject file URLs', () => {
        const result = securityService.validateUrl('file:///path/to/file');
        expect(result.isValid).to.be.false;
        expect(result.error).to.include('Protocol');
        expect(result.error).to.include('file:');
      });
    });

    describe('Hostname Validation', () => {
      it('should reject localhost', () => {
        const result = securityService.validateUrl('http://localhost');
        expect(result.isValid).to.be.false;
        expect(result.error).to.include('localhost');
      });

      it('should reject 127.0.0.1', () => {
        const result = securityService.validateUrl('http://127.0.0.1');
        expect(result.isValid).to.be.false;
        expect(result.error).to.include('127.0.0.1');
      });

      it('should reject private IP ranges', () => {
        const privateIPs = [
          'http://192.168.1.1',
          'http://10.0.0.1',
          'http://172.16.0.1',
          'http://172.20.0.1',
          'http://172.31.0.1'
        ];

        privateIPs.forEach(ip => {
          const result = securityService.validateUrl(ip);
          expect(result.isValid).to.be.false;
          expect(result.error).to.include('Private');
        });
      });

      it('should reject cloud metadata servers', () => {
        const result = securityService.validateUrl('http://169.254.169.254');
        expect(result.isValid).to.be.false;
        expect(result.error).to.include('169.254.169.254');
      });
    });

    describe('Suspicious Characters', () => {
      it('should reject URLs with % character', () => {
        const result = securityService.validateUrl('http://example%test.com');
        expect(result.isValid).to.be.false;
        expect(result.error).to.include('suspicious characters');
      });

      it('should reject URLs with @ character', () => {
        const result = securityService.validateUrl('http://example@test.com');
        expect(result.isValid).to.be.false;
        expect(result.error).to.include('suspicious characters');
      });

      it('should reject URLs with \\ character', () => {
        const result = securityService.validateUrl('http://example\\test.com');
        expect(result.isValid).to.be.false;
        expect(result.error).to.include('suspicious characters');
      });
    });

    describe('Invalid URL Format', () => {
      it('should reject malformed URLs', () => {
        const result = securityService.validateUrl('not-a-url');
        expect(result.isValid).to.be.false;
        expect(result.error).to.include('Invalid URL format');
      });

      it('should reject empty URLs', () => {
        const result = securityService.validateUrl('');
        expect(result.isValid).to.be.false;
        expect(result.error).to.include('Invalid URL format');
      });
    });
  });

  describe('validateUrls', () => {
    it('should return valid and invalid URLs separately', () => {
      const urls = [
        'https://example.com',
        'http://localhost',
        'https://httpbin.org',
        'ftp://example.com'
      ];

      const result = securityService.validateUrls(urls);

      expect(result.validUrls).to.have.length(2);
      expect(result.validUrls).to.include('https://example.com/');
      expect(result.validUrls).to.include('https://httpbin.org/');

      expect(result.invalidUrls).to.have.length(2);
      expect(result.invalidUrls[0].url).to.equal('http://localhost');
      expect(result.invalidUrls[1].url).to.equal('ftp://example.com');
    });

    it('should handle all valid URLs', () => {
      const urls = ['https://example.com', 'https://httpbin.org'];
      const result = securityService.validateUrls(urls);

      expect(result.validUrls).to.have.length(2);
      expect(result.invalidUrls).to.have.length(0);
    });

    it('should handle all invalid URLs', () => {
      const urls = ['http://localhost', 'ftp://example.com'];
      const result = securityService.validateUrls(urls);

      expect(result.validUrls).to.have.length(0);
      expect(result.invalidUrls).to.have.length(2);
    });
  });

  describe('sanitizeData', () => {
    it('should sanitize strings', () => {
      const input = 'test\x00string\x01with\x02control\x03chars';
      const result = securityService.sanitizeData(input);
      expect(result).to.equal('teststringwithcontrolchars');
    });

    it('should sanitize objects', () => {
      const input = {
        name: 'test\x00name',
        value: 'test\x01value'
      };
      const result = securityService.sanitizeData(input) as { name: string; value: string };
      expect(result.name).to.equal('testname');
      expect(result.value).to.equal('testvalue');
    });

    it('should sanitize arrays', () => {
      const input = ['test\x00item', 'test\x01item'];
      const result = securityService.sanitizeData(input) as string[];
      expect(result[0]).to.equal('testitem');
      expect(result[1]).to.equal('testitem');
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: 'test\x00user',
          data: ['item\x01one', 'item\x02two']
        }
      };
      const result = securityService.sanitizeData(input) as { user: { name: string; data: string[] } };
      expect(result.user.name).to.equal('testuser');
      expect(result.user.data[0]).to.equal('itemone');
      expect(result.user.data[1]).to.equal('itemtwo');
    });

    it('should handle non-string data', () => {
      const input = { number: 123, boolean: true, null: null };
      const result = securityService.sanitizeData(input) as { number: number; boolean: boolean; null: null };
      expect(result.number).to.equal(123);
      expect(result.boolean).to.be.true;
      expect(result.null).to.be.null;
    });
  });
}); 