/**
 * Stock Intelligence Service
 * All AI methods are MOCKED_PENDING_MODEL_INTEGRATION.
 * Each method is labelled with a comment indicating what the real model should replace.
 * Mocked data is realistic and matches the actual response contract.
 */
import { Injectable, Inject } from '@nestjs/common';
import { eq, and, lte, desc, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  stores,
  demandForecasts,
  stockItems,
  stockBatches,
  products,
  coPurchasePatterns,
  aiInsights,
} from '../../database/schema';

@Injectable()
export class StockIntelligenceService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: call time-series forecasting model with SKU sales history.
   */
  async getDemandForecast(productId: string, storeId: string, horizonDays = 30) {
    const [existing] = await this.db
      .select()
      .from(demandForecasts)
      .where(and(eq(demandForecasts.productId, productId), eq(demandForecasts.storeId, storeId)))
      .orderBy(desc(demandForecasts.createdAt))
      .limit(1);

    if (existing && !existing.isMocked) return existing;

    // Generate mock forecast
    const today = new Date().toISOString().split('T')[0];
    const [product] = await this.db.select().from(products).where(eq(products.id, productId)).limit(1);
    const [stockItem] = await this.db
      .select()
      .from(stockItems)
      .where(and(eq(stockItems.productId, productId), eq(stockItems.storeId, storeId)))
      .limit(1);

    const currentStock = stockItem?.quantityOnHand ?? 0;
    const predicted = Math.floor(Math.random() * 20) + 10;
    const daysLeft = currentStock > 0 ? Math.ceil((currentStock / predicted) * horizonDays) : 0;

    const [forecast] = await this.db
      .insert(demandForecasts)
      .values({
        productId,
        storeId,
        forecastDate: today,
        horizonDays,
        predictedUnits: predicted,
        confidenceLow: Math.floor(predicted * 0.8),
        confidenceHigh: Math.ceil(predicted * 1.2),
        daysOfStockLeft: daysLeft,
        suggestedReorderQty: Math.max(product?.reorderQty ?? 10, predicted * 2),
        signals: { trend: 'stable', seasonality: 1.0, promoLift: 0.0 },
        reasoning: `Based on recent sales patterns, ${product?.name ?? 'this product'} is expected to sell ~${predicted} units over ${horizonDays} days. Current stock covers approximately ${daysLeft} days.`,
        isMocked: true,
      })
      .onConflictDoNothing()
      .returning();

    return forecast ?? existing;
  }

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: use demand forecasts + live stock levels to rank urgency.
   */
  async getReorderSuggestions(storeId: string) {
    const items = await this.db
      .select({ stockItem: stockItems, product: products })
      .from(stockItems)
      .innerJoin(products, eq(products.id, stockItems.productId))
      .where(eq(stockItems.storeId, storeId));

    return items
      .filter(({ stockItem, product }) => stockItem.quantityOnHand <= product.reorderPoint)
      .map(({ stockItem, product }) => {
        const daysLeft = Math.floor(Math.random() * 10) + 1; // MOCKED
        const urgency =
          stockItem.quantityOnHand === 0 ? 'critical'
          : daysLeft <= 3 ? 'critical'
          : daysLeft <= 7 ? 'warning'
          : 'info';

        return {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          currentStock: stockItem.quantityOnHand,
          reorderPoint: product.reorderPoint,
          suggestedQty: product.reorderQty,
          daysOfStockLeft: daysLeft,
          urgency,
          reasoning: `Stock at ${stockItem.quantityOnHand} units is at or below reorder point of ${product.reorderPoint}. Estimated ${daysLeft} days of stock remaining.`,
          isMocked: true,
        };
      })
      .sort((a, b) => a.daysOfStockLeft - b.daysOfStockLeft);
  }

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: combine batch expiry dates with demand forecast to rank true risk.
   */
  async getExpiryRiskReport(storeId?: string | null) {
    const now = new Date();
    const in90Days = new Date(now);
    in90Days.setDate(now.getDate() + 90);

    const conditions: any[] = [
      eq(stockBatches.isActive, true),
      lte(stockBatches.expiryDate, in90Days.toISOString().split('T')[0]),
    ];
    if (storeId && storeId !== 'all') {
      conditions.push(eq(stockBatches.storeId, storeId));
    }

    const batches = await this.db
      .select({ batch: stockBatches, product: products })
      .from(stockBatches)
      .innerJoin(products, eq(products.id, stockBatches.productId))
      .where(and(...conditions))
      .orderBy(stockBatches.expiryDate);

    return batches.map(({ batch, product }) => {
      const expiryDate = new Date(batch.expiryDate!);
      const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const severity = daysToExpiry <= 30 ? 'critical' : 'warning';

      return {
        productId: product.id,
        productName: product.name,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        daysToExpiry,
        quantityAtRisk: batch.quantityRemaining,
        severity,
        suggestedActions: daysToExpiry <= 30
          ? ['apply_discount_20pct', 'bundle_deal', 'return_to_supplier']
          : ['apply_discount_10pct', 'feature_in_promotions'],
      };
    });
  }

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: query co-purchase model trained on historical sales baskets.
   */
  async getUpsellSuggestions(productIds: string[], storeId: string) {
    const patterns = await this.db
      .select({ pattern: coPurchasePatterns, product: products })
      .from(coPurchasePatterns)
      .innerJoin(products, eq(products.id, coPurchasePatterns.productBId))
      .where(
        and(
          eq(coPurchasePatterns.storeId, storeId),
          inArray(coPurchasePatterns.productAId, productIds),
        ),
      )
      .orderBy(desc(coPurchasePatterns.confidenceScore))
      .limit(15);

    if (patterns.length > 0) return { suggestions: patterns, isMocked: false };

    // Fallback mock — return 3 random products from store
    const mockProducts = await this.db
      .select()
      .from(products)
      .limit(3);

    return {
      suggestions: mockProducts.map((p) => ({
        product: p,
        confidenceScore: Math.floor(Math.random() * 30) + 50,
        reason: 'Frequently bought together (mocked)',
      })),
      isMocked: true,
      note: 'MOCKED_PENDING_MODEL_INTEGRATION — train co-purchase model on sales basket data',
    };
  }

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: batch job reads sales history and upserts real forecasts.
   */
  async triggerForecastRefresh(storeId: string) {
    const items = await this.db
      .select({ productId: stockItems.productId })
      .from(stockItems)
      .where(eq(stockItems.storeId, storeId));

    let refreshed = 0;
    for (const { productId } of items) {
      await this.getDemandForecast(productId, storeId);
      refreshed++;
    }

    return {
      refreshed,
      storeId,
      isMocked: true,
      note: 'MOCKED_PENDING_MODEL_INTEGRATION — replace with scheduled ML batch job',
    };
  }

  /**
   * Cross-Branch Stock Level Intelligence
   * Identifies inter-branch stock balancing opportunities:
   * Recommends transferring surplus inventory from well-stocked branches (e.g., Dzorwulu or Israel Park)
   * to branches facing low stock or stockouts (e.g., Sowutuom).
   */
  async getTransferRecommendations(targetStoreId?: string) {
    // 1. Fetch all active stores
    const allStores = await this.db.select().from(stores).where(eq(stores.status, 'active'));
    if (allStores.length < 2) return [];

    // 2. Fetch all stock items with products
    const allStockItems = await this.db
      .select({
        stockId: stockItems.id,
        productId: products.id,
        productName: products.name,
        sku: products.sku,
        reorderPoint: products.reorderPoint,
        reorderQty: products.reorderQty,
        costPricePesewas: products.costPricePesewas,
        storeId: stockItems.storeId,
        quantityOnHand: stockItems.quantityOnHand,
      })
      .from(stockItems)
      .innerJoin(products, eq(stockItems.productId, products.id))
      .where(sql`${products.status} = 'active'`);

    // Group by product
    const productStoreMap = new Map<string, Array<{
      storeId: string;
      quantityOnHand: number;
      productName: string;
      sku: string;
      reorderPoint: number;
      reorderQty: number;
      costPricePesewas: number;
    }>>();

    for (const item of allStockItems) {
      if (!productStoreMap.has(item.productId)) {
        productStoreMap.set(item.productId, []);
      }
      productStoreMap.get(item.productId)!.push(item);
    }

    const storeMap = new Map(allStores.map((s) => [s.id, s.name]));
    const recommendations: any[] = [];

    for (const [productId, storeEntries] of productStoreMap.entries()) {
      // Find stores that are low on this product
      const lowStores = storeEntries.filter(
        (se) => se.quantityOnHand <= Math.max(1, se.reorderPoint) &&
          (!targetStoreId || se.storeId === targetStoreId),
      );

      // Find stores that have surplus
      const surplusStores = storeEntries.filter(
        (se) => se.quantityOnHand > (se.reorderPoint * 2) && se.quantityOnHand >= 10,
      );

      for (const lowStore of lowStores) {
        for (const surplusStore of surplusStores) {
          if (lowStore.storeId === surplusStore.storeId) continue;

          const transferableSurplus = Math.floor(surplusStore.quantityOnHand - surplusStore.reorderPoint);
          if (transferableSurplus < 2) continue;

          const recommendedQty = Math.min(
            transferableSurplus,
            lowStore.reorderQty || 10,
          );

          if (recommendedQty <= 0) continue;

          const isCritical = lowStore.quantityOnHand === 0;

          recommendations.push({
            productId,
            productName: lowStore.productName,
            sku: lowStore.sku,
            unitCostPesewas: lowStore.costPricePesewas,
            fromStoreId: surplusStore.storeId,
            fromStoreName: storeMap.get(surplusStore.storeId) || 'Source Branch',
            fromStoreStock: surplusStore.quantityOnHand,
            toStoreId: lowStore.storeId,
            toStoreName: storeMap.get(lowStore.storeId) || 'Destination Branch',
            toStoreStock: lowStore.quantityOnHand,
            recommendedQty,
            urgency: isCritical ? 'critical' : 'warning',
            potentialSavingsPesewas: recommendedQty * lowStore.costPricePesewas,
            reasoning: isCritical
              ? `${storeMap.get(lowStore.storeId) || 'Destination'} is completely OUT OF STOCK (0 units), while ${storeMap.get(surplusStore.storeId) || 'Source'} has ${surplusStore.quantityOnHand} units. Transferring ${recommendedQty} units prevents lost sales without needing a new supplier purchase order.`
              : `${storeMap.get(lowStore.storeId) || 'Destination'} is running low (${lowStore.quantityOnHand} units remaining, threshold: ${lowStore.reorderPoint}). ${storeMap.get(surplusStore.storeId) || 'Source'} has a surplus of ${surplusStore.quantityOnHand} units. Rebalancing ${recommendedQty} units optimizes inventory turnover.`,
          });
        }
      }
    }

    return recommendations.sort((a, b) => (a.urgency === 'critical' ? -1 : 1));
  }
}
