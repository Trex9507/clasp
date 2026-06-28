import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  listingId: string;

  @IsOptional()
  @IsString()
  offerId?: string;

  @IsEnum(['hand_off', 'courier'])
  deliveryMethod: 'hand_off' | 'courier';

  @IsOptional()
  @IsString()
  deliveryAddress?: string;
}
