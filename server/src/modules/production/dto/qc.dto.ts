import { IsString, IsIn, IsOptional } from 'class-validator';

export class QcDto {
  @IsString() @IsIn(['pass', 'reject'])
  action: string;
  @IsOptional() @IsString()
  remark?: string;
}
