import { Injectable, Logger, BadRequestException } from '@nestjs/common';

export interface UrlValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedUrl?: string;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  // Private/internal IP ranges and cloud metadata servers
  private readonly BLOCKED_IP_RANGES = [
    // Private IP ranges
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    // Link-local addresses
    /^169\.254\./,
    // Loopback
    /^127\./,
    // Cloud metadata servers
    /^169\.254\.169\.254$/,
    /^169\.254\.170\.2$/,
    // AWS metadata
    /^169\.254\.169\.254$/,
    // Google Cloud metadata
    /^169\.254\.169\.254$/,
    // Azure metadata
    /^169\.254\.169\.254$/,
  ];

  // Blocked hostnames
  private readonly BLOCKED_HOSTNAMES = [
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    'metadata.google.internal',
    '169.254.169.254',
    '169.254.170.2',
  ];

  // Suspicious characters in hostnames
  private readonly SUSPICIOUS_CHARS = /[%@\\]/;

  // Allowed protocols
  private readonly ALLOWED_PROTOCOLS = ['http:', 'https:'];

  /**
   * Validates and sanitizes a URL according to security rules
   */
  validateUrl(url: string): UrlValidationResult {
    try {
      // Check for suspicious characters in the URL before parsing
      if (this.SUSPICIOUS_CHARS.test(url)) {
        const error = `URL contains suspicious characters. Characters %, @, \\ are not allowed.`;
        this.logger.warn(`URL validation failed: ${error} - URL: ${url}`);
        return { isValid: false, error };
      }

      // Parse URL safely
      const parsedUrl = new URL(url);
      
      // 1. Check allowed protocols
      if (!this.ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
        const error = `Protocol '${parsedUrl.protocol}' is not allowed. Only http:// and https:// are permitted.`;
        this.logger.warn(`URL validation failed: ${error} - URL: ${url}`);
        return { isValid: false, error };
      }

      // 2. Check for blocked hostnames
      const hostname = parsedUrl.hostname.toLowerCase();
      if (this.BLOCKED_HOSTNAMES.includes(hostname)) {
        const error = `Hostname '${hostname}' is not allowed.`;
        this.logger.warn(`URL validation failed: ${error} - URL: ${url}`);
        return { isValid: false, error };
      }

      // 3. Check for private/internal IP ranges
      if (this.isPrivateIp(hostname)) {
        const error = `Private/internal IP addresses are not allowed.`;
        this.logger.warn(`URL validation failed: ${error} - URL: ${url}`);
        return { isValid: false, error };
      }

      // 4. Check for cloud metadata servers
      if (this.isCloudMetadataServer(hostname)) {
        const error = `Cloud metadata servers are not allowed.`;
        this.logger.warn(`URL validation failed: ${error} - URL: ${url}`);
        return { isValid: false, error };
      }

      // URL is valid, return sanitized version
      return { 
        isValid: true, 
        sanitizedUrl: this.sanitizeUrl(parsedUrl.toString()) 
      };

    } catch (error) {
      const errorMessage = `Invalid URL format: ${error.message}`;
      this.logger.warn(`URL validation failed: ${errorMessage} - URL: ${url}`);
      return { isValid: false, error: errorMessage };
    }
  }

  /**
   * Validates multiple URLs and returns results
   */
  validateUrls(urls: string[]): { validUrls: string[]; invalidUrls: { url: string; error: string }[] } {
    const validUrls: string[] = [];
    const invalidUrls: { url: string; error: string }[] = [];

    for (const url of urls) {
      const result = this.validateUrl(url);
      if (result.isValid && result.sanitizedUrl) {
        validUrls.push(result.sanitizedUrl);
      } else if (result.error) {
        invalidUrls.push({ url, error: result.error });
      }
    }

    return { validUrls, invalidUrls };
  }

  /**
   * Sanitizes data before storing in database
   */
  sanitizeData(data: unknown): unknown {
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    } else if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map(item => this.sanitizeData(item));
      } else {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          sanitized[key] = this.sanitizeData(value);
        }
        return sanitized;
      }
    }
    return data;
  }

  /**
   * Sanitizes a string to prevent injection attacks
   */
  private sanitizeString(str: string): string {
    if (typeof str !== 'string') {
      return str;
    }

    // Remove null bytes
    str = str.replace(/\0/g, '');
    
    // Remove control characters except newlines and tabs
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Normalize whitespace
    str = str.replace(/\s+/g, ' ').trim();
    
    return str;
  }

  /**
   * Sanitizes URL by removing potentially dangerous parts
   */
  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      
      // Remove fragments for security
      parsed.hash = '';
      
      // Normalize the URL
      return parsed.toString();
    } catch {
      return url;
    }
  }

  /**
   * Checks if hostname is a private IP address
   */
  private isPrivateIp(hostname: string): boolean {
    // Check if it's an IP address
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(hostname)) {
      return false;
    }

    // Check against blocked IP ranges
    return this.BLOCKED_IP_RANGES.some(range => range.test(hostname));
  }

  /**
   * Checks if hostname is a cloud metadata server
   */
  private isCloudMetadataServer(hostname: string): boolean {
    const metadataPatterns = [
      /^metadata\./,
      /^169\.254\.169\.254$/,
      /^169\.254\.170\.2$/,
      /\.internal$/,
      /\.local$/,
    ];

    return metadataPatterns.some(pattern => pattern.test(hostname));
  }
} 