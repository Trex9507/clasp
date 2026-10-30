import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('wishlist')
export class WishlistController {
  constructor(private wishlistService: WishlistService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req: any, @Body() body: { description: string; maxBudget?: number }) {
    return this.wishlistService.create(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: any) {
    return this.wishlistService.findAllByUser(req.user.sub);
  }

  @Get('user/:userId')
  findActiveByUser(@Param('userId') userId: string) {
    return this.wishlistService.findActive(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: { description?: string; maxBudget?: number; isActive?: boolean }) {
    return this.wishlistService.update(req.user.sub, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.wishlistService.remove(req.user.sub, id);
  }
}
