import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, IsArray } from 'class-validator';

export class CreateListingDto {
  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  categoryId: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsEnum(['new_with_tags', 'like_new', 'good', 'fair'])
  condition: 'new_with_tags' | 'like_new' | 'good' | 'fair';

  @IsNumber()
  @Min(0)
  price: number;

  @IsEnum(['hand_off', 'courier', 'both'])
  deliveryOptions: 'hand_off' | 'courier' | 'both';

  @IsOptional()
  @IsString()
  verificationCode?: string;

  @IsOptional()
  @IsString()
  verificationPhotoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];
}
