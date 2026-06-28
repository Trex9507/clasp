import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /brands', () => {
    it('should return seeded brands', () => {
      return request(app.getHttpServer())
        .get('/brands')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(8);
          const nike = res.body.find((b: any) => b.name === 'Nike');
          expect(nike).toBeDefined();
          expect(nike.verificationType).toBe('tag');
        });
    });
  });

  describe('GET /categories', () => {
    it('should return nested categories', () => {
      return request(app.getHttpServer())
        .get('/categories')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const women = res.body.find((c: any) => c.name === 'Women');
          expect(women).toBeDefined();
          expect(women.children.length).toBeGreaterThanOrEqual(3);
        });
    });
  });

  describe('POST /users', () => {
    it('should create a user', () => {
      const email = `e2e-${Date.now()}@test.com`;
      return request(app.getHttpServer())
        .post('/users')
        .send({ email, password: 'test123', name: 'E2E User', city: 'dubai' })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.email).toBe(email);
        });
    });

    it('should reject invalid input', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });

  describe('Listings', () => {
    let userId: string;
    let nikeId: string;
    let listingId: string;

    beforeAll(async () => {
      const email = `listing-e2e-${Date.now()}@test.com`;
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ email, password: 'test123', name: 'Seller', city: 'dubai' });
      userId = res.body.id;

      const brands = await request(app.getHttpServer()).get('/brands');
      nikeId = brands.body.find((b: any) => b.name === 'Nike').id;
    });

    it('POST /listings — should create a verified listing', async () => {
      const res = await request(app.getHttpServer())
        .post('/listings')
        .send({
          sellerId: userId,
          title: 'Nike Dunk Low',
          categoryId: 'men-shoes',
          brandId: nikeId,
          condition: 'like_new',
          price: 500,
          deliveryOptions: 'both',
          verificationCode: 'DD1391-100',
          verificationPhotoUrl: 'https://example.com/tag.jpg',
          photoUrls: ['https://example.com/p1.jpg'],
        })
        .expect(201);

      expect(res.body.verificationStatus).toBe('verified');
      expect(res.body.photos).toHaveLength(1);
      listingId = res.body.id;
    });

    it('GET /listings — should return feed', async () => {
      const res = await request(app.getHttpServer())
        .get('/listings')
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /listings?verifiedOnly=true — should filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/listings?verifiedOnly=true')
        .expect(200);

      res.body.items.forEach((item: any) => {
        expect(item.verificationStatus).toBe('verified');
      });
    });

    it('GET /listings/:id — should return listing detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/listings/${listingId}`)
        .expect(200);

      expect(res.body.title).toBe('Nike Dunk Low');
      expect(res.body.seller).toBeDefined();
    });

    it('DELETE /listings/:id — should soft-delete', async () => {
      await request(app.getHttpServer())
        .delete(`/listings/${listingId}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/listings/${listingId}`)
        .expect(200);
      expect(res.body.status).toBe('removed');
    });
  });
});
