import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class CreateUrlFetchDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  urls: string[];
} 