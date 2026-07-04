import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateProductDto {
  @IsString() model: string;
  @IsString() name: string;
  @IsOptional() @IsObject() specs?: Record<string, any>;
  @IsOptional() @IsString() unit?: string;
}
