import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadService {
  private s3: S3Client;
  private bucket: string;

  constructor(private config: ConfigService) {
    const endpoint = config.get<string>('S3_ENDPOINT');
    this.bucket = config.get<string>('S3_BUCKET', 'secondhand-uae-photos');

    this.s3 = new S3Client({
      region: config.get<string>('S3_REGION', 'us-east-1'),
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: config.get<string>('S3_ACCESS_KEY', ''),
        secretAccessKey: config.get<string>('S3_SECRET_KEY', ''),
      },
    });
  }

  async getPresignedUploadUrl(folder: string, contentType: string): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
    const ext = contentType.split('/')[1] || 'jpg';
    const key = `${folder}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 600 });

    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const fileUrl = endpoint
      ? `${endpoint}/${this.bucket}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;

    return { uploadUrl, fileUrl, key };
  }
}
