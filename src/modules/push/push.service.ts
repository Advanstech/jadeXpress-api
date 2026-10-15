import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import * as webpush from 'web-push';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { pushSubscriptions, staffProfile } from '../../database/schema';

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

interface PushRule {
  roles: string[];
  build: (data: any) => PushPayload;
}

const MANAGERS = ['manager', 'owner', 'supervisor', 'root'];
const money = (p?: number) => (typeof p === 'number' ? `GH₵${(p / 100).toFixed(2)}` : '');

/**
 * Which realtime events also go out as push, and to whom. Push is for things
 * that need a manager's attention even when the app is closed — routine events
 * (sales, inventory refreshes) stay in-app only.
 */
const RULES: Record<string, PushRule> = {
  'refund:completed': {
    roles: MANAGERS,
    build: (d) => ({
      title: 'Refund approved',
      body: `${money(d?.totalAmountPesewas)} refunded — stock and accounts updated`,
      url: '/refunds',
      tag: `refund-${d?.refundId ?? ''}`,
    }),
  },
  'sale:voided': {
    roles: MANAGERS,
    build: () => ({ title: 'Sale voided', url: '/sales-history', tag: 'sale-voided' }),
  },
  'stock:alert': {
    roles: [...MANAGERS, 'pharmacist'],
    build: (d) => ({ title: 'Stock alert', body: d?.message, url: '/inventory', tag: 'stock-alert' }),
  },
  'eod:closed': {
    roles: MANAGERS,
    build: () => ({ title: 'End of day closed — awaiting approval', url: '/end-of-day', tag: 'eod' }),
  },
  'eod_shift:closed': {
    roles: MANAGERS,
    build: () => ({ title: 'A shift was closed — awaiting approval', url: '/end-of-day', tag: 'eod-shift' }),
  },
  'eod:approved': {
    roles: MANAGERS,
    build: () => ({ title: 'End of day approved', url: '/end-of-day', tag: 'eod' }),
  },
  'eod:rejected': {
    roles: MANAGERS,
    build: () => ({ title: 'End of day rejected', url: '/end-of-day', tag: 'eod' }),
  },
  notification: {
    roles: [...MANAGERS, 'cashier', 'pharmacist'],
    build: (d) => ({ title: d?.title ?? 'JadeXpress', body: d?.body, tag: 'notification' }),
  },
};

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;
  readonly publicKey: string | null;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@jadexpressgh.com';
    this.publicKey = pub ?? null;
    this.enabled = !!(pub && priv);
    if (this.enabled) {
      webpush.setVapidDetails(subject, pub!, priv!);
    } else {
      this.logger.warn('VAPID keys not set — web push disabled (in-app realtime still works)');
    }
  }

  isEnabled() {
    return this.enabled;
  }

  async subscribe(
    user: { sub: string; storeId: string },
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string,
  ) {
    await this.db
      .insert(pushSubscriptions)
      .values({
        storeId: user.storeId,
        staffId: user.sub,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: userAgent?.slice(0, 255),
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        // Same browser, possibly a different staff member signing in
        set: {
          storeId: user.storeId,
          staffId: user.sub,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          userAgent: userAgent?.slice(0, 255),
        },
      });
    return { subscribed: true };
  }

  async unsubscribe(user: { sub: string }, endpoint: string) {
    await this.db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.staffId, user.sub)));
    return { subscribed: false };
  }

  /** Fire-and-forget hook called from the realtime gateway. Never throws. */
  async dispatchEvent(storeId: string, event: string, data: unknown) {
    const rule = RULES[event];
    if (!rule || !this.enabled) return;
    try {
      await this.sendToStore(storeId, rule.roles, rule.build(data));
    } catch (err) {
      this.logger.warn(`Push dispatch failed for ${event}: ${(err as Error).message}`);
    }
  }

  async sendToStore(storeId: string, roles: string[], payload: PushPayload) {
    const rows = await this.db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
        role: staffProfile.role,
      })
      .from(pushSubscriptions)
      .innerJoin(staffProfile, eq(staffProfile.id, pushSubscriptions.staffId))
      .where(and(eq(pushSubscriptions.storeId, storeId), eq(staffProfile.isActive, true)));

    const targets = rows.filter((r) => roles.includes(String(r.role)));
    if (!targets.length) return;

    const body = JSON.stringify(payload);
    const dead: string[] = [];
    const ok: string[] = [];

    await Promise.all(
      targets.map(async (t) => {
        try {
          await webpush.sendNotification(
            { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
            body,
            { TTL: 60 * 60 * 12, urgency: 'normal' },
          );
          ok.push(t.id);
        } catch (err: any) {
          // 404/410 = subscription expired or revoked — prune it
          if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(t.id);
          else this.logger.warn(`Push send failed (${err?.statusCode ?? 'n/a'}): ${err?.message}`);
        }
      }),
    );

    if (dead.length) {
      await this.db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
    }
    if (ok.length) {
      await this.db
        .update(pushSubscriptions)
        .set({ lastUsedAt: new Date() })
        .where(inArray(pushSubscriptions.id, ok));
    }
  }
}
