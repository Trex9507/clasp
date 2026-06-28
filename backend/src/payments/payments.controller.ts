import { Controller, Post, Param, UseGuards, Request, Get, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

@Controller('payments')
export class PaymentsController {
  constructor(
    private payments: PaymentsService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('initiate/:orderId')
  async initiate(@Request() req: any, @Param('orderId') orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: { select: { name: true, email: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId !== req.user.id) throw new BadRequestException('Not your order');
    if (order.status !== 'pending_payment') throw new BadRequestException('Order not awaiting payment');

    const callbackUrl = `${req.protocol}://${req.get('host')}/payments/callback`;
    const result = await this.payments.initiatePayment(
      orderId,
      Number(order.finalPrice),
      order.buyer.name,
      order.buyer.email,
      callbackUrl,
    );

    await this.prisma.order.update({
      where: { id: orderId },
      data: { escrowPaymentRefId: result.paymentId },
    });

    return result;
  }

  @Get('callback')
  async callback(@Query('paymentId') paymentId: string) {
    if (!paymentId) throw new BadRequestException('Missing paymentId');

    const status = await this.payments.getPaymentStatus(paymentId);

    const order = await this.prisma.order.findFirst({
      where: { escrowPaymentRefId: paymentId },
    });

    if (!order) throw new NotFoundException('Order not found for payment');

    if (status.status === 'paid' && order.status === 'pending_payment') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'paid_escrow' },
      });
      this.notifications.notifyOrderPaid(order.sellerId, order.id);
      return { success: true, orderId: order.id, status: 'paid_escrow' };
    }

    return { success: false, orderId: order.id, status: status.status };
  }
}
