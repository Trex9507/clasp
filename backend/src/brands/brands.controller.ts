import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('brands')
export class BrandsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }
}
