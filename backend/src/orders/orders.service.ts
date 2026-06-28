import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(buyerId: string, dto: CreateOrderDto) {
    const listing = await this.prisma.listing.findUnique({ where: { id: dto.listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== 'active') throw new BadRequestException('Listing is not available');
    if (listing.sellerId === buyerId) throw new BadRequestException('Cannot buy your own listing');

    let finalPrice = listing.price;

    if (dto.offerId) {
      const offer = await this.prisma.offer.findUnique({ where: { id: dto.offerId } });
      if (!offer || offer.status !== 'accepted') throw new BadRequestException('Offer not accepted');
      if (offer.buyerId !== buyerId) throw new ForbiddenException('Not your offer');
      finalPrice = offer.amount;
    }

    if (dto.deliveryMethod === 'courier' && !dto.deliveryAddress) {
      throw new BadRequestException('Delivery address required for courier');
    }

    const order = await this.prisma.order.create({
      data: {
        listingId: dto.listingId,
        buyerId,
        sellerId: listing.sellerId,
        offerId: dto.offerId || null,
        finalPrice,
        deliveryMethod: dto.deliveryMethod,
        deliveryAddress: dto.deliveryAddress || null,
      },
      include: { listing: { select: { title: true } } },
    });

    await this.prisma.listing.update({
      where: { id: dto.listingId },
      data: { status: 'reserved' },
    });

    return order;
  }

  async pay(buyerId: string, orderId: string) {
    const order = await this.findOneOrFail(orderId);
    if (order.buyerId !== buyerId) throw new ForbiddenException('Not your order');
    if (order.status !== 'pending_payment') throw new BadRequestException('Order not awaiting payment');

    // MyFatoorah placeholder — in production this would call the payment API
    const escrowRef = `MF-PLACEHOLDER-${Date.now()}`;

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'paid_escrow', escrowPaymentRefId: escrowRef },
    });
  }

  async ship(sellerId: string, orderId: string, trackingNumber?: string) {
    const order = await this.findOneOrFail(orderId);
    if (order.sellerId !== sellerId) throw new ForbiddenException('Not your order');
    if (order.status !== 'paid_escrow') throw new BadRequestException('Order not paid yet');

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'shipped', trackingNumber: trackingNumber || null },
    });
  }

  async confirmDelivery(buyerId: string, orderId: string) {
    const order = await this.findOneOrFail(orderId);
    if (order.buyerId !== buyerId) throw new ForbiddenException('Not your order');
    if (order.status !== 'shipped') throw new BadRequestException('Order not shipped');

    const deliveredAt = new Date();
    const disputeDeadlineAt = new Date(deliveredAt.getTime() + 48 * 60 * 60 * 1000);

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'dispute_window', deliveredAt, disputeDeadlineAt },
    });
  }

  async complete(orderId: string) {
    const order = await this.findOneOrFail(orderId);
    if (order.status !== 'dispute_window') throw new BadRequestException('Order not in dispute window');
    if (order.disputeDeadlineAt && order.disputeDeadlineAt > new Date()) {
      throw new BadRequestException('Dispute window still open');
    }

    // Release escrow — MyFatoorah placeholder
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'completed' },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: {
        listing: { select: { id: true, title: true, photos: { take: 1 } } },
        buyer: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        listing: { include: { photos: true, brand: true } },
        buyer: { select: { id: true, name: true, city: true } },
        seller: { select: { id: true, name: true, city: true } },
        disputes: true,
      },
    });
  }

  private async findOneOrFail(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
