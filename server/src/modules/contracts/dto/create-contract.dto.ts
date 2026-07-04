import { IsString, IsArray, ValidateNested, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ContractItemDto {
  @IsNumber()
  product_id: number;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class CreateContractDto {
  @IsString()
  customer_name: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsOptional()
  @IsString()
  customer_address?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractItemDto)
  items: ContractItemDto[];
}
