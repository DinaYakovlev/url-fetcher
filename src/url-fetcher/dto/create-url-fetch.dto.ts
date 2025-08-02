import { IsArray, IsString, ArrayMinSize, ArrayMaxSize, IsUrl } from 'class-validator';

export class CreateUrlFetchDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one URL is required' })
  @ArrayMaxSize(100, { message: 'Maximum 100 URLs allowed per request' })
  @IsString({ each: true, message: 'Each URL must be a string' })
  urls: string[];
} 