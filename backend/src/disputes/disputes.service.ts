import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';

@Injectable()
export class DisputesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateDisputeDto) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId !== userId) throw new ForbiddenException('Only the buyer can open a dispute');
    if (order.status !== 'dispute_window') throw new BadRequestException('Order not in dispute window');

    if (order.disputeDeadlineAt && order.disputeDeadlineAt < new Date()) {
      throw new BadRequestException('Dispute window has expired');
    }

    const sellerResponseDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const dispute = await this.prisma.dispute.create({
      data: {
        orderId: dto.orderId,
        openedBy: userId,
        reason: dto.reason,
        description: dto.description,
        status: 'awaiting_seller',
        sellerResponseDeadlineAt: sellerResponseDeadline,
      },
    });

    await this.prisma.order.update({
      where: { id: dto.orderId },
      data: { status: 'disputed' },
    });

    return dispute;
  }

  async sellerRespond(sellerId: string, disputeId: string, response: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: true },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.order.sellerId !== sellerId) throw new ForbiddenException('Not your dispute');
    if (dispute.status !== 'awaiting_seller') throw new BadRequestException('Dispute not awaiting seller response');

    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: 'under_review', resolutionNotes: `Seller response: ${response}` },
    });
  }

  async resolve(disputeId: string, resolution: 'resolved_refund' | 'resolved_release', notes?: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: true },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');

    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: resolution, resolutionNotes: notes },
    });

    const orderStatus = resolution === 'resolved_refund' ? 'refunded' : 'completed';
    await this.prisma.order.update({
      where: { id: dispute.orderId },
      data: { status: orderStatus as any },
    });

    return { disputeId, resolution, orderStatus };
  }

  async findByOrder(orderId: string) {
    return this.prisma.dispute.findMany({
      where: { orderId },
      include: { opener: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
