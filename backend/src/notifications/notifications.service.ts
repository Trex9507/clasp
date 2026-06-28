import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: App | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    if (projectId) {
      this.firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail: this.config.get<string>('FIREBASE_CLIENT_EMAIL'),
          privateKey: this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        }),
      });
      this.logger.log('Firebase initialized');
    } else {
      this.logger.warn('Firebase not configured — push notifications disabled');
    }
  }

  async registerToken(userId: string, fcmToken: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
      select: { id: true },
    });
  }

  async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      this.logger.debug(`No FCM token for user ${userId} — skipping push`);
      return;
    }

    if (!this.firebaseApp) {
      this.logger.debug(`Firebase not configured — would send "${title}" to ${userId}`);
      return;
    }

    try {
      await getMessaging(this.firebaseApp).send({
        token: user.fcmToken,
        notification: { title, body },
        data: data || {},
      });
    } catch (error) {
      this.logger.error(`Failed to send push to ${userId}: ${error}`);
    }
  }

  async notifyNewOffer(sellerId: string, buyerName: string, amount: number, listingTitle: string) {
    await this.sendToUser(sellerId, 'New Offer', `${buyerName} offered AED ${amount} for "${listingTitle}"`, { type: 'offer' });
  }

  async notifyOfferResponse(buyerId: string, action: string, listingTitle: string) {
    const label = action === 'accepted' ? 'accepted' : action === 'rejected' ? 'rejected' : 'countered';
    await this.sendToUser(buyerId, `Offer ${label}`, `Your offer on "${listingTitle}" was ${label}`, { type: 'offer_response' });
  }

  async notifyOrderPaid(sellerId: string, orderId: string) {
    await this.sendToUser(sellerId, 'Order Paid', `Payment received — time to ship!`, { type: 'order_paid', orderId });
  }

  async notifyOrderShipped(buyerId: string, orderId: string, trackingNumber?: string) {
    const body = trackingNumber ? `Your item has been shipped (tracking: ${trackingNumber})` : 'Your item has been shipped';
    await this.sendToUser(buyerId, 'Item Shipped', body, { type: 'order_shipped', orderId });
  }

  async notifyDisputeOpened(sellerId: string, orderId: string) {
    await this.sendToUser(sellerId, 'Dispute Opened', `A dispute was opened on one of your orders`, { type: 'dispute', orderId });
  }

  async notifyNewReview(revieweeId: string, reviewerName: string, rating: number) {
    await this.sendToUser(revieweeId, 'New Review', `${reviewerName} gave you a ${rating}-star review`, { type: 'review' });
  }
}
