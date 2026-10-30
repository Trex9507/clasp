import { Controller, Post, Delete, Get, Param, UseGuards, Request } from '@nestjs/common';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('follows')
export class FollowsController {
  constructor(private followsService: FollowsService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':userId')
  follow(@Request() req: any, @Param('userId') userId: string) {
    return this.followsService.follow(req.user.sub, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':userId')
  unfollow(@Request() req: any, @Param('userId') userId: string) {
    return this.followsService.unfollow(req.user.sub, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('check/:userId')
  isFollowing(@Request() req: any, @Param('userId') userId: string) {
    return this.followsService.isFollowing(req.user.sub, userId);
  }

  @Get('followers/:userId')
  getFollowers(@Param('userId') userId: string) {
    return this.followsService.getFollowers(userId);
  }

  @Get('following/:userId')
  getFollowing(@Param('userId') userId: string) {
    return this.followsService.getFollowing(userId);
  }
}
