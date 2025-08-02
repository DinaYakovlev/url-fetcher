import { expect } from 'chai';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

export class TestUtils {
  static async createTestingModule(): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  }

  static async createApp(): Promise<INestApplication> {
    const moduleFixture = await this.createTestingModule();
    const app = moduleFixture.createNestApplication();
    
    // Configure the app like in main.ts
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }));
    app.setGlobalPrefix('v1');
    
    await app.init();
    return app;
  }

  static createRequestForRunningServer(): any {
    return request('http://localhost:3000');
  }

  static async closeApp(app: INestApplication): Promise<void> {
    await app.close();
  }

  static createRequest(app: INestApplication): any {
    return request(app.getHttpServer());
  }

  static expectSuccess(response: { status: number; body: unknown }): void {
    expect(response.status).to.be.oneOf([200, 201]);
    expect(response.body).to.have.property('message');
    expect(response.body).to.have.property('data');
  }

  static expectError(response: { status: number; body: unknown }, statusCode: number = 400): void {
    expect(response.status).to.equal(statusCode);
    expect(response.body).to.have.property('message');
  }

  static expectValidationError(response: { status: number; body: unknown }): void {
    this.expectError(response, 400);
    const body = response.body as { message: string };
    expect(body.message).to.include('validation');
  }

  static expectSecurityError(response: { status: number; body: unknown }): void {
    this.expectError(response, 400);
    const body = response.body as { message: string };
    expect(body.message).to.include('security validation');
  }
} 