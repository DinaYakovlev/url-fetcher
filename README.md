# URL Fetcher Service

A NestJS service for fetching URLs and storing the results in PostgreSQL. Built with TypeScript and Node.js 24.x.x.

## Features

- **POST /v1/url-fetches**: Fetch multiple URLs concurrently and store results
- **GET /v1/url-fetches**: Retrieve all stored URL fetch data with pagination and filtering
- **HTTP Integration**: Robust HTTP client with timeout and error handling
- **PostgreSQL Integration**: Persistent storage with TypeORM
- **Security**: Comprehensive URL validation and data sanitization
- **Validation**: Request validation using class-validator
- **Logging**: Comprehensive logging throughout the application

## Prerequisites

- Node.js 24.x.x
- PostgreSQL database
- npm or yarn

## Installation

### Upgrading Node.js

This project requires Node.js 24.x.x. If you're using an older version, you can upgrade using nvm:

```bash
# Install nvm if you don't have it
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart your terminal or run
source ~/.bashrc

# Install Node.js 24
nvm install 24
nvm use 24

# Verify the version
node --version
```

1. Clone the repository:
```bash
git clone <repository-url>
cd url-fetcher
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit the `.env` file with your database configuration:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=url-fetcher
PORT=3000
NODE_ENV=development
```

4. Create the PostgreSQL database:
```sql
CREATE DATABASE url_fetcher;
```

## Running the Application

### Development
```bash
npm run start:dev
```

### Production
```bash
npm run build
npm run start:prod
```

The application will be available at `http://localhost:3000`

## Error Handling
The service implements comprehensive error handling for database-related issues:

### Database Error Handling
- **Connection Errors**: Returns 503 Service Unavailable for database connection failures
- **Deadlocks**: Handles PostgreSQL deadlock detection (error code 40P01)
- **Transaction Rollbacks**: Manages transaction failures and rollbacks
- **Lock Timeouts**: Handles lock acquisition failures (error code 55P03)
- **Query Timeouts**: Manages query execution timeouts
- **Database Shutdown**: Handles database server shutdown scenarios

### Error Response Format
```json
{
  "statusCode": 503,
  "message": "Service temporarily unavailable",
  "error": "Service Unavailable"
}
```

## Security Features

The service implements comprehensive security measures to protect against malicious URLs and data injection:

### URL Validation
- **Protocol Allowlist**: Only `http://` and `https://` protocols are allowed
- **Private IP Blocking**: All private/internal IP ranges are blocked (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x)
- **Cloud Metadata Protection**: Cloud metadata servers (169.254.169.254, etc.) are blocked
- **Localhost Protection**: Localhost and loopback addresses are blocked
- **Suspicious Character Detection**: URLs containing `%`, `@`, `\` characters are blocked
- **URL Format Validation**: Invalid URL formats are rejected

### Data Sanitization
- **Input Sanitization**: All stored data is sanitized to prevent injection attacks
- **Control Character Removal**: Null bytes and control characters are stripped
- **Whitespace Normalization**: Excessive whitespace is normalized
- **Response Format**: All responses use snake_case field names for consistency

### Error Handling
- **400 Bad Request**: Invalid URLs return detailed error messages
- **Warning Logs**: All security violations are logged with warnings
- **Mixed Validation**: If any URL fails validation, the entire request is rejected

## API Endpoints

### GET /health

Check the health status of the service and database connection.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "database": {
    "status": "connected",
    "responseTime": 5
  }
}
```

**Status Codes:**
- `200 OK`: Service is healthy
- `503 Service Unavailable`: Service is unhealthy (database disconnected)

### GET /metrics

Get Prometheus-formatted metrics for HTTP requests and database queries.

**Response:** Returns Prometheus metrics in text format:
```
# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",url="https://example.com",status="200",le="0.1"} 5
http_request_duration_seconds_bucket{method="GET",url="https://example.com",status="200",le="0.5"} 12
...

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",url="https://example.com",status="200"} 15

# HELP database_query_duration_seconds Duration of database queries in seconds
# TYPE database_query_duration_seconds histogram
database_query_duration_seconds_bucket{operation="save_fetch_results",le="0.001"} 0
database_query_duration_seconds_bucket{operation="save_fetch_results",le="0.005"} 2
...

# HELP database_queries_total Total number of database queries
# TYPE database_queries_total counter
database_queries_total{operation="save_fetch_results"} 25
```



### POST /v1/url-fetches

Fetch multiple URLs in parallel and store the results. All URLs are validated for security before processing. If a URL already exists in the database, it will be updated with the latest response data (upsert behavior).

**Request Body:**
```json
{
  "urls": [
    "https://example.com",
    "https://google.com",
    "https://github.com"
  ]
}
```

**Response:**
```json
{
  "message": "Successfully fetched 3 URLs in parallel",
  "data": [
    {
      "id": 1,
      "url": "https://example.com",
      "response_status": 200,
      "response_headers": { "content-type": "text/html" },
      "response_body": "<html>...</html>",
      "content_type": "text/html",
      "fetched_at": "2024-01-01T12:00:00.000Z"
    }
  ],
  "count": 3,
  "processingTime": 1250
}
```

### GET /v1/url-fetches

Retrieve URL fetch data with pagination and filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `status` (optional): Filter by HTTP status code
- `url` (optional): Filter by URL regex pattern
- `startDate` (optional): Filter by start date (ISO format)
- `endDate` (optional): Filter by end date (ISO format)

**Examples:**
```
GET /v1/url-fetches?page=1&limit=20
GET /v1/url-fetches?status=200
GET /v1/url-fetches?url=example\.com
GET /v1/url-fetches?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z
```

**Response:**
```json
{
  "message": "Successfully retrieved URL fetches",
  "data": [
    {
      "id": 1,
      "url": "https://example.com",
      "response_status": 200,
      "response_headers": { "content-type": "text/html" },
      "response_body": "<html>...</html>",
      "content_type": "text/html",
      "fetched_at": "2024-01-01T12:00:00.000Z"
    }
  ],
  "count": 1,
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalPages": 5,
    "totalItems": 50
  }
}
```



### GET /v1/url-fetches/:id

Get a specific URL fetch by ID.

**Response:**
```json
{
  "message": "URL fetch found",
  "data": {
    "id": 1,
    "url": "https://example.com",
    "responseStatus": 200,
    "responseHeaders": { "content-type": "text/html" },
    "responseBody": "<html>...</html>",
    "contentType": "text/html",
    "fetchedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

## Project Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts             # Root module
├── url-fetcher/              # URL fetcher feature module
│   ├── url-fetcher.module.ts
│   ├── url-fetcher.controller.ts
│   ├── url-fetcher.service.ts
│   ├── entities/
│   │   └── url-fetch.entity.ts
│   └── dto/
│       └── create-url-fetch.dto.ts
└── integrations/             # External service integrations
    ├── http/
    │   └── http.service.ts
    └── postgres/
        └── postgres.service.ts
```

## Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Development

### Available Scripts

- `npm run build` - Build the application
- `npm run start` - Start the application
- `npm run start:dev` - Start in development mode with hot reload
- `npm run start:debug` - Start in debug mode
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Database Setup

The application automatically creates the required table and indexes on startup. The database structure includes:

```sql
CREATE TABLE url_fetches (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  response_status INT,
  response_headers JSONB,
  response_body TEXT,
  content_type TEXT,
  fetched_at TIMESTAMPTZ DEFAULT now()
);
```

-- Indexes for performance
CREATE INDEX idx_url ON url_fetches (url);
CREATE INDEX idx_status ON url_fetches (response_status);
CREATE INDEX idx_fetched_at ON url_fetches (fetched_at DESC);
CREATE INDEX idx_url_trgm ON url_fetches USING gin (url gin_trgm_ops);

-- Extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

For local development with Docker PostgreSQL:
```bash
# Start PostgreSQL container
docker run --name postgres-url-fetcher \
  -e POSTGRES_DB=url_fetcher \
  -e POSTGRES_USER=postgres \
  -p 5432:5432 \
  -d postgres:15
```

## Error Handling

The service includes comprehensive error handling:

- HTTP request timeouts (30 seconds)
- Database connection errors
- Validation errors for request bodies
- Graceful handling of failed URL fetches

## Logging

The application uses NestJS built-in logging with different log levels:
- Info: Successful operations
- Error: Failed operations with detailed error messages
- Debug: Detailed debugging information (in debug mode)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC 