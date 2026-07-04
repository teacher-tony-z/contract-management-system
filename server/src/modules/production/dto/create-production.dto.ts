import { IsNumber } from 'class-validator';

export class CreateProductionDto {
  @IsNumber()
  contract_id: number;
}
