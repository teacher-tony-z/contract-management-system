import { IsString, IsDateString, IsOptional } from 'class-validator';

export class AfterSaleDto {
  @IsDateString() test_date: string;
  @IsString() test_result: string;
  @IsOptional() @IsString() remark?: string;
}
