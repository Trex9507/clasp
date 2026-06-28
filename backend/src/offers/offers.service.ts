import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { RespondOfferDto } from './dto/respond-offer.dto';

@Injectable()
export class OffersService {
  constructor(private prisma: PrismaService) {}

  async create(buyerId: string, dto: CreateOfferDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== 'active') throw new BadRequestException('Listing is not available');
    if (listing.sellerId === buyerId) throw new BadRequestException('Cannot make an offer on your own listing');

    const existingPending = await this.prisma.offer.findFirst({
      where: { listingId: dto.listingId, buyerId, status: 'pending' },
    });
    if (existingPending) throw new BadRequestException('You already have a pending offer on this listing');

    return this.prisma.offer.create({
      data: {
        listingId: dto.listingId,
        buyerId,
        amount: dto.amount,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      include: { listing: { select: { title: true, price: true } }, buyer: { select: { id: true, name: true } } },
    });
  }

  async respond(sellerId: string, offerId: string, dto: RespondOfferDto) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { listing: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.listing.sellerId !== sellerId) throw new ForbiddenException('Not your listing');
    if (offer.status !== 'pending') throw new BadRequestException('Offer is no longer pending');

    if (dto.action === 'countered') {
      if (!dto.counterAmount) throw new BadRequestException('Counter amount required');

      await this.prisma.offer.update({
        where: { id: offerId },
        data: { status: 'countered' },
      });

      return this.prisma.offer.create({
        data: {
          listingId: offer.listingId,
          buyerId: offer.buyerId,
          amount: dto.counterAmount,
          status: 'pending',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        include: { listing: { select: { title: true, price: true } } },
      });
    }

    return this.prisma.offer.update({
      where: { id: offerId },
      data: { status: dto.action },
      include: { listing: { select: { title: true, price: true } } },
    });
  }

  async findByListing(listingId: string) {
    return this.prisma.offer.findMany({
      where: { listingId },
      include: { buyer: { select: { id: true, name: true, profilePhotoUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.offer.findMany({
      where: { buyerId: userId },
      include: { listing: { select: { id: true, title: true, price: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
