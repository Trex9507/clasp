import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class RespondOfferDto {
  @IsEnum(['accepted', 'rejected', 'countered'])
  action: 'accepted' | 'rejected' | 'countered';

  @IsOptional()
  @IsNumber()
  @Min(1)
  counterAmount?: number;
}
