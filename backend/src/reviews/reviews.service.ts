import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(reviewerId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'completed') throw new BadRequestException('Order not completed');

    const isBuyer = order.buyerId === reviewerId;
    const isSeller = order.sellerId === reviewerId;
    if (!isBuyer && !isSeller) throw new ForbiddenException('Not part of this order');

    const revieweeId = isBuyer ? order.sellerId : order.buyerId;

    const review = await this.prisma.review.create({
      data: {
        orderId: dto.orderId,
        reviewerId,
        revieweeId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });

    // Update reviewee's average rating
    const stats = await this.prisma.review.aggregate({
      where: { revieweeId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.user.update({
      where: { id: revieweeId },
      data: {
        ratingAvg: stats._avg.rating || 0,
        ratingCount: stats._count.rating,
      },
    });

    return review;
  }

  async findByUser(userId: string) {
    return this.prisma.review.findMany({
      where: { revieweeId: userId },
      include: { reviewer: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
