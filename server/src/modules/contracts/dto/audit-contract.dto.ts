import { IsString, IsIn, IsOptional } from 'class-validator';

export class AuditContractDto {
  @IsString()
  @IsIn(['pass', 'reject'])
  action: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
