import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  orderId: string;

  @IsEnum(['not_authentic', 'not_as_described', 'damaged', 'not_received', 'other'])
  reason: 'not_authentic' | 'not_as_described' | 'damaged' | 'not_received' | 'other';

  @IsOptional()
  @IsString()
  description?: string;
}
