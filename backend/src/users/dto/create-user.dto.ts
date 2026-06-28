import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsEnum(['dubai', 'abu_dhabi'])
  city: 'dubai' | 'abu_dhabi';

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;
}
