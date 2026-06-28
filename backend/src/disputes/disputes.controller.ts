import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsOptional, IsString } from 'class-validator';

class SellerResponseDto {
  @IsString()
  response: string;
}

@UseGuards(JwtAuthGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private disputesService: DisputesService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateDisputeDto) {
    return this.disputesService.create(req.user.id, dto);
  }

  @Patch(':id/respond')
  sellerRespond(@Request() req: any, @Param('id') id: string, @Body() dto: SellerResponseDto) {
    return this.disputesService.sellerRespond(req.user.id, id, dto.response);
  }

  @Get('order/:orderId')
  findByOrder(@Param('orderId') orderId: string) {
    return this.disputesService.findByOrder(orderId);
  }
}
