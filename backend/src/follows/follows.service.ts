import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FollowsService {
  constructor(private prisma: PrismaService) {}

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) throw new ConflictException('Cannot follow yourself');
    try {
      return await this.prisma.follow.create({ data: { followerId, followingId } });
    } catch {
      throw new ConflictException('Already following');
    }
  }

  async unfollow(followerId: string, followingId: string) {
    await this.prisma.follow.deleteMany({ where: { followerId, followingId } });
    return { ok: true };
  }

  async isFollowing(followerId: string, followingId: string) {
    const f = await this.prisma.follow.findUnique({ where: { followerId_followingId: { followerId, followingId } } });
    return { following: !!f };
  }

  async getFollowers(userId: string) {
    return this.prisma.follow.findMany({
      where: { followingId: userId },
      include: { follower: { select: { id: true, name: true, profilePhotoUrl: true, city: true } } },
    });
  }

  async getFollowing(userId: string) {
    return this.prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: { select: { id: true, name: true, profilePhotoUrl: true, city: true } } },
    });
  }

  async getFollowerCount(userId: string) {
    return this.prisma.follow.count({ where: { followingId: userId } });
  }
}
