/**
 * Analytics Seeder
 *
 * Seeds pageViews data for analytics dashboards
 */

import { BaseSeeder, type SeedDependency } from './base';
import type { Doc } from '../_generated/dataModel';
import { deletePageViewAggregates } from '../lib/aggregates/pageViews';

type PageViewData = Omit<Doc<'pageViews'>, '_creationTime' | '_id'>;

const PATHS = ['/', '/products', '/posts', '/about', '/contact', '/services', '/cart', '/checkout'];
const DEVICES = ['mobile', 'desktop', 'tablet'] as const;
const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge'];
const COUNTRIES = ['VN', 'US', 'SG', 'JP', 'KR'];

export class AnalyticsSeeder extends BaseSeeder<PageViewData> {
  moduleName = 'analytics';
  tableName = 'pageViews';
  dependencies: SeedDependency[] = [];

  generateFake(): PageViewData {
    const sessionId = this.faker.string.uuid();

    return {
      browser: this.randomElement(BROWSERS),
      country: this.randomElement(COUNTRIES),
      device: this.randomElement([...DEVICES]),
      os: this.faker.helpers.arrayElement(['iOS', 'Android', 'Windows', 'macOS', 'Linux']),
      path: this.randomElement(PATHS),
      referrer: this.randomBoolean(0.4) ? this.faker.internet.url() : undefined,
      sessionId,
      userAgent: this.faker.internet.userAgent(),
    };
  }

  validateRecord(record: PageViewData): boolean {
    return !!record.path && !!record.sessionId;
  }

  protected async clear(): Promise<void> {
    const records = await this.ctx.db.query('pageViews').collect();
    
    // Xoá pageViews và aggregates tương ứng
    // Dùng chunk để tránh quá tải mutation nếu có nhiều record
    const chunkSize = 50;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (record) => {
          await deletePageViewAggregates(this.ctx as any, record);
          await this.ctx.db.delete(record._id);
        })
      );
    }

    // Xoá pageViewSessionBuckets
    const buckets = await this.ctx.db.query('pageViewSessionBuckets').collect();
    for (let i = 0; i < buckets.length; i += chunkSize) {
      const chunk = buckets.slice(i, i + chunkSize);
      await Promise.all(chunk.map((b) => this.ctx.db.delete(b._id)));
    }

    // Xoá cờ settings
    const readySetting = await this.ctx.db.query('settings').withIndex('by_key', q => q.eq('key', 'pageViewsAggregatesReady')).unique();
    if (readySetting) await this.ctx.db.delete(readySetting._id);
    
    const backfillSetting = await this.ctx.db.query('settings').withIndex('by_key', q => q.eq('key', 'pageViewsAggregatesBackfilledAt')).unique();
    if (backfillSetting) await this.ctx.db.delete(backfillSetting._id);
  }
}
