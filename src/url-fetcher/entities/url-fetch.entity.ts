import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('url_fetches')
@Index('idx_url', ['url'])
@Index('idx_status', ['responseStatus'])
@Index('idx_fetched_at', ['fetchedAt'])
export class UrlFetch {
  @PrimaryGeneratedColumn('increment')
  id: number;

          @Column({ type: 'text', unique: true })
        url: string;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus: number;

  @Column({ name: 'response_headers', type: 'jsonb', nullable: true })
  responseHeaders: Record<string, unknown>;

  @Column({ name: 'response_body', type: 'text', nullable: true })
  responseBody: string;

  @Column({ name: 'content_type', type: 'text', nullable: true })
  contentType: string;

  @CreateDateColumn({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt: Date;

  toJSON() {
    return {
      id: this.id,
      url: this.url,
      response_status: this.responseStatus,
      response_headers: this.responseHeaders,
      response_body: this.responseBody,
      content_type: this.contentType,
      fetched_at: this.fetchedAt,
    };
  }
} 