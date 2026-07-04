import { IsNumber, IsString } from 'class-validator';

export class AdjustDto {
  @IsNumber() quantity: number;
  @IsString() reason: string;
}
