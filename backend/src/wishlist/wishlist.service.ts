import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, data: { description: string; maxBudget?: number }) {
    return this.prisma.wishlistItem.create({
      data: { userId, ...data },
    });
  }

  findAllByUser(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findActive(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(userId: string, id: string, data: { description?: string; maxBudget?: number; isActive?: boolean }) {
    const item = await this.prisma.wishlistItem.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException();
    return this.prisma.wishlistItem.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    const item = await this.prisma.wishlistItem.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException();
    await this.prisma.wishlistItem.delete({ where: { id } });
    return { ok: true };
  }
}
