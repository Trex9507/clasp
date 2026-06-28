import { IsNumber, IsString, Min } from 'class-validator';

export class CreateOfferDto {
  @IsString()
  listingId: string;

  @IsNumber()
  @Min(1)
  amount: number;
}
