import { IsString, MinLength, IsOptional, IsArray, IsNumber } from 'class-validator';

export class CreateUserDto {
  @IsString() @MinLength(2) username: string;
  @IsString() @MinLength(4) password: string;
  @IsString() real_name: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsArray() @IsNumber({}, { each: true }) role_ids?: number[];
}
