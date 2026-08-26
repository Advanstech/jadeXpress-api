/**
 * Drizzle ORM — Postgres enums
 * All enums in one file to avoid circular imports.
 */
import { pgEnum } from 'drizzle-orm/pg-core';

// ─── Organisation / Store ─────────────────────────────────────────────────────
export const storeStatusEnum = pgEnum('store_status', ['active', 'inactive', 'coming_soon']);

// ─── User & Auth ──────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', [
  'owner',
  'manager',
  'supervisor',
  'cashier',
  'pharmacist',    // dormant — activated when Rx module is enabled
  'stock_officer',
]);

// ─── Staff / Shift ────────────────────────────────────────────────────────────
export const shiftStatusEnum = pgEnum('shift_status', ['open', 'closed', 'discrepancy']);

// ─── Product / Inventory ──────────────────────────────────────────────────────
export const productStatusEnum = pgEnum('product_status', [
  'active',
  'inactive',
  'discontinued',
  'pending_review',
]);

export const productTypeEnum = pgEnum('product_type', [
  'supplement',     // current phase: vitamins & supplements (OTC)
  'beauty',         // beauty & personal care
  'otc_medicine',   // future phase: OTC drugs
  'rx_medicine',    // future phase: prescription drugs (requires pharmacist role)
  'equipment',
  'consumable',
]);

export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'purchase_in',        // goods received from supplier
  'sale_out',           // sold at POS
  'return_in',          // customer return / refund restocked
  'adjustment_in',      // manual positive adjustment
  'adjustment_out',     // manual negative adjustment (damaged, expired, stolen)
  'transfer_in',        // inter-branch transfer received
  'transfer_out',       // inter-branch transfer sent
  'opening_stock',      // initial stock entry
]);

export const stockAlertTypeEnum = pgEnum('stock_alert_type', [
  'low_stock',
  'out_of_stock',
  'expiry_soon',        // ≤ 90 days
  'expiry_critical',    // ≤ 30 days
  'overstock',
  'reorder_due',
]);

export const alertSeverityEnum = pgEnum('alert_severity', ['info', 'warning', 'critical']);

// ─── Sales / POS ──────────────────────────────────────────────────────────────
export const saleStatusEnum = pgEnum('sale_status', [
  'held',
  'in_progress',
  'completed',
  'voided',
  'refunded',
  'partially_refunded',
]);

export const tenderTypeEnum = pgEnum('tender_type', [
  'cash',
  'momo',       // Ghana mobile money
  'card',
  'store_credit',
  'split',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'partial',
  'overpaid',
  'refunded',
]);

// ─── Suppliers / Purchasing ───────────────────────────────────────────────────
export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', [
  'draft',
  'submitted',
  'acknowledged',
  'partial',
  'received',
  'invoiced',
  'paid',
  'cancelled',
]);

export const supplierPerformanceRatingEnum = pgEnum('supplier_performance_rating', [
  'excellent',
  'good',
  'fair',
  'poor',
]);

// ─── Expenses ─────────────────────────────────────────────────────────────────
export const expenseCategoryEnum = pgEnum('expense_category', [
  'rent',
  'utilities',
  'salaries',
  'supplies',
  'marketing',
  'maintenance',
  'transport',
  'regulatory',
  'insurance',
  'miscellaneous',
]);

// ─── Refunds ──────────────────────────────────────────────────────────────────
export const refundReasonEnum = pgEnum('refund_reason', [
  'customer_request',
  'defective_product',
  'wrong_item',
  'overcharge',
  'duplicate_sale',
  'near_expiry',
  'other',
]);

export const refundStatusEnum = pgEnum('refund_status', [
  'pending_approval',
  'approved',
  'rejected',
  'processed',
]);

export const refundMethodEnum = pgEnum('refund_method', [
  'cash',
  'momo',
  'card',
  'store_credit',
]);

// ─── Accounting / Ledger ──────────────────────────────────────────────────────
export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'debit',
  'credit',
]);

export const ledgerCategoryEnum = pgEnum('ledger_category', [
  'revenue',
  'cost_of_goods',
  'expense',
  'tax',
  'refund',
  'adjustment',
  'opening_balance',
]);

// ─── Transfers ────────────────────────────────────────────────────────────────
export const stockTransferStatusEnum = pgEnum('stock_transfer_status', [
  'draft',
  'in_transit',
  'received',
  'cancelled',
]);

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app',
  'sms',
  'email',
  'push',
]);

// ─── Audit ────────────────────────────────────────────────────────────────────
export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'pin_auth',
  'override',
  'export',
  'print',
]);

// ─── AI ───────────────────────────────────────────────────────────────────────
export const aiInsightTypeEnum = pgEnum('ai_insight_type', [
  'demand_forecast',
  'reorder_suggestion',
  'expiry_risk',
  'upsell_recommendation',
  'anomaly_detected',
  'nl_query_result',
  'ocr_extraction',
]);

// ─── Prescriptions (dormant — Phase 2 Rx) ────────────────────────────────────
export const prescriptionStatusEnum = pgEnum('prescription_status', [
  'pending',
  'verified',
  'dispensed',
  'cancelled',
  'expired',
]);

// ─── Storefront (online orders) ──────────────────────────────────────────────
export const storefrontOrderStatusEnum = pgEnum('storefront_order_status', [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]);

export const storefrontPaymentStatusEnum = pgEnum('storefront_payment_status', [
  'unpaid',
  'paid',
  'demo',
]);
