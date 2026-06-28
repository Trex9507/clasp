import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { SearchListingDto } from './dto/search-listing.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ListingsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateListingDto) {
    const { photoUrls, verificationCode, verificationPhotoUrl, ...data } = dto;

    let verificationStatus: 'not_applicable' | 'unverified' | 'verified' = 'not_applicable';

    if (data.brandId) {
      const brand = await this.prisma.brand.findUnique({ where: { id: data.brandId } });
      if (brand && brand.verificationType !== 'none') {
        verificationStatus = verificationCode && verificationPhotoUrl ? 'verified' : 'unverified';
      }
    }

    const listing = await this.prisma.listing.create({
      data: {
        ...data,
        sellerId: data.sellerId!,
        verificationStatus,
        verificationCode: verificationCode || null,
        verificationPhotoUrl: verificationPhotoUrl || null,
        photos: photoUrls?.length
          ? { create: photoUrls.map((url, i) => ({ url, sortOrder: i })) }
          : undefined,
      },
      include: { photos: true, brand: true, category: true },
    });

    return listing;
  }

  async findOne(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { photos: { orderBy: { sortOrder: 'asc' } }, brand: true, category: true, seller: { select: { id: true, name: true, profilePhotoUrl: true, city: true, ratingAvg: true, ratingCount: true } } },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async search(dto: SearchListingDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const where: Prisma.ListingWhereInput = { status: 'active' };

    if (dto.q) {
      where.OR = [
        { title: { contains: dto.q, mode: 'insensitive' } },
        { description: { contains: dto.q, mode: 'insensitive' } },
      ];
    }
    if (dto.categoryId) where.categoryId = dto.categoryId;
    if (dto.brandId) where.brandId = dto.brandId;
    if (dto.size) where.size = dto.size;
    if (dto.condition) where.condition = dto.condition as any;
    if (dto.priceMin || dto.priceMax) {
      where.price = {};
      if (dto.priceMin) where.price.gte = dto.priceMin;
      if (dto.priceMax) where.price.lte = dto.priceMax;
    }
    if (dto.verifiedOnly) where.verificationStatus = 'verified';

    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: { photos: { orderBy: { sortOrder: 'asc' }, take: 1 }, brand: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.listing.update({
      where: { id },
      data: { status: 'removed' },
    });
  }
}
