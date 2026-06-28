import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsString } from 'class-validator';

class RegisterTokenDto {
  @IsString()
  fcmToken: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('register-token')
  registerToken(@Request() req: any, @Body() dto: RegisterTokenDto) {
    return this.notificationsService.registerToken(req.user.id, dto.fcmToken);
  }
}
