import { IsNumber, IsString, IsArray, ValidateNested, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class DeliveryItemDto {
  @IsNumber() product_id: number;
  @IsNumber() @Min(1) quantity: number;
}

export class CreateDeliveryDto {
  @IsNumber() contract_id: number;
  @IsString() logistics_company: string;
  @IsOptional() @IsString() tracking_no?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => DeliveryItemDto)
  items: DeliveryItemDto[];
}
