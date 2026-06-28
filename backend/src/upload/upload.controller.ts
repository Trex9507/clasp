import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsEnum, IsString } from 'class-validator';

class PresignedUrlDto {
  @IsEnum(['listing', 'verification', 'profile'])
  folder: 'listing' | 'verification' | 'profile';

  @IsString()
  contentType: string;
}

@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @UseGuards(JwtAuthGuard)
  @Post('presign')
  getPresignedUrl(@Body() dto: PresignedUrlDto) {
    return this.uploadService.getPresignedUploadUrl(dto.folder, dto.contentType);
  }
}
