import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsOptional, IsString } from 'class-validator';

class ShipDto {
  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.id, dto);
  }

  @Post(':id/pay')
  pay(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.pay(req.user.id, id);
  }

  @Patch(':id/ship')
  ship(@Request() req: any, @Param('id') id: string, @Body() dto: ShipDto) {
    return this.ordersService.ship(req.user.id, id, dto.trackingNumber);
  }

  @Patch(':id/delivered')
  confirmDelivery(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.confirmDelivery(req.user.id, id);
  }

  @Get('my')
  findMine(@Request() req: any) {
    return this.ordersService.findByUser(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
