import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireOffers() {
    const result = await this.prisma.offer.updateMany({
      where: { status: 'pending', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} offers`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async autoReleaseEscrow() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: 'dispute_window',
        disputeDeadlineAt: { lt: new Date() },
      },
    });

    for (const order of orders) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'completed' },
      });
    }

    if (orders.length > 0) {
      this.logger.log(`Auto-released escrow for ${orders.length} orders`);
    }
  }
}
