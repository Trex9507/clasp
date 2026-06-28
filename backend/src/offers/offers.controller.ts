import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { RespondOfferDto } from './dto/respond-offer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('offers')
export class OffersController {
  constructor(private offersService: OffersService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateOfferDto) {
    return this.offersService.create(req.user.id, dto);
  }

  @Patch(':id/respond')
  respond(@Request() req: any, @Param('id') id: string, @Body() dto: RespondOfferDto) {
    return this.offersService.respond(req.user.id, id, dto);
  }

  @Get('my')
  findMine(@Request() req: any) {
    return this.offersService.findByUser(req.user.id);
  }

  @Get('listing/:listingId')
  findByListing(@Param('listingId') listingId: string) {
    return this.offersService.findByListing(listingId);
  }
}
