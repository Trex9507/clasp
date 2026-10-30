import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsEnum, IsString } from 'class-validator';

class PresignedUrlDto {
  @IsEnum(['listing', 'verification', 'profile'])
  folder: 'listing' | 'verification' | 'profile';

  @IsString()
  contentType: string;
}

const localStorage = diskStorage({
  destination: join(__dirname, '..', '..', 'uploads'),
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${extname(file.originalname)}`);
  },
});

@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @UseGuards(JwtAuthGuard)
  @Post('presign')
  getPresignedUrl(@Body() dto: PresignedUrlDto) {
    return this.uploadService.getPresignedUploadUrl(dto.folder, dto.contentType);
  }

  @UseGuards(JwtAuthGuard)
  @Post('local')
  @UseInterceptors(FileInterceptor('file', { storage: localStorage, limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadLocal(@UploadedFile() file: Express.Multer.File) {
    return {
      fileUrl: `/uploads/${file.filename}`,
      key: file.filename,
      originalName: file.originalname,
      size: file.size,
    };
  }
}
