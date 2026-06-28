import { IsOptional, IsString, IsEnum } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['dubai', 'abu_dhabi'])
  city?: 'dubai' | 'abu_dhabi';

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;
}
