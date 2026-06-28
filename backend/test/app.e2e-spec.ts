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

  describe('Auth', () => {
    const email = `auth-e2e-${Date.now()}@test.com`;
    let accessToken: string;

    it('POST /auth/register — should register and return token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'test123', name: 'Auth User', city: 'dubai' })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(email);
      accessToken = res.body.accessToken;
    });

    it('POST /auth/login — should login and return token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'test123' })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      accessToken = res.body.accessToken;
    });

    it('POST /auth/login — should reject wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrongpass' })
        .expect(401);
    });

    it('GET /auth/me — should return profile with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(email);
    });

    it('GET /auth/me — should reject without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });
  });

  describe('Listings (authenticated)', () => {
    let accessToken: string;
    let nikeId: string;
    let listingId: string;

    beforeAll(async () => {
      const email = `listing-e2e-${Date.now()}@test.com`;
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'test123', name: 'Seller', city: 'dubai' });
      accessToken = res.body.accessToken;

      const brands = await request(app.getHttpServer()).get('/brands');
      nikeId = brands.body.find((b: any) => b.name === 'Nike').id;
    });

    it('POST /listings — should reject without auth', async () => {
      await request(app.getHttpServer())
        .post('/listings')
        .send({ title: 'Test', categoryId: 'men-shoes', condition: 'good', price: 100, deliveryOptions: 'both' })
        .expect(401);
    });

    it('POST /listings — should create a verified listing with auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
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

    it('GET /listings — should return feed (public)', async () => {
      const res = await request(app.getHttpServer())
        .get('/listings')
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /listings?verifiedOnly=true — should filter verified', async () => {
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

    it('DELETE /listings/:id — should require auth', async () => {
      await request(app.getHttpServer())
        .delete(`/listings/${listingId}`)
        .expect(401);
    });

    it('DELETE /listings/:id — should soft-delete with auth', async () => {
      await request(app.getHttpServer())
        .delete(`/listings/${listingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/listings/${listingId}`)
        .expect(200);
      expect(res.body.status).toBe('removed');
    });
  });

  describe('Offers', () => {
    let sellerToken: string;
    let buyerToken: string;
    let listingId: string;
    let offerId: string;

    beforeAll(async () => {
      // Create seller + listing
      const sellerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `seller-offer-${Date.now()}@test.com`, password: 'test123', name: 'Seller', city: 'dubai' });
      sellerToken = sellerRes.body.accessToken;

      const brands = await request(app.getHttpServer()).get('/brands');
      const nikeId = brands.body.find((b: any) => b.name === 'Nike').id;

      const listingRes = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ title: 'Offer Test Item', categoryId: 'men-shoes', brandId: nikeId, condition: 'good', price: 1000, deliveryOptions: 'both' });
      listingId = listingRes.body.id;

      // Create buyer
      const buyerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `buyer-offer-${Date.now()}@test.com`, password: 'test123', name: 'Buyer', city: 'abu_dhabi' });
      buyerToken = buyerRes.body.accessToken;
    });

    it('POST /offers — should create an offer', async () => {
      const res = await request(app.getHttpServer())
        .post('/offers')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ listingId, amount: 800 })
        .expect(201);

      expect(res.body.amount).toBe(800);
      expect(res.body.status).toBe('pending');
      offerId = res.body.id;
    });

    it('POST /offers — seller cannot offer on own listing', async () => {
      await request(app.getHttpServer())
        .post('/offers')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ listingId, amount: 500 })
        .expect(400);
    });

    it('GET /offers/my — should return buyer offers', async () => {
      const res = await request(app.getHttpServer())
        .get('/offers/my')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /offers/:id/respond — seller can counter', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/offers/${offerId}/respond`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ action: 'countered', counterAmount: 900 })
        .expect(200);

      expect(res.body.amount).toBe(900);
      expect(res.body.status).toBe('pending');
    });

    it('GET /offers/listing/:id — should list offers for listing', async () => {
      const res = await request(app.getHttpServer())
        .get(`/offers/listing/${listingId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });
});
