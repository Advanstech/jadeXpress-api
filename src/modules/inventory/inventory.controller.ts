import {
  Controller, Get, Post, Put, Patch, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationSchema } from '../../common/dto/pagination.dto';
import {
  CreateProductSchema, CreateProductDto,
  UpdateProductSchema, UpdateProductDto,
  StockAdjustmentSchema, StockAdjustmentDto,
  CreateBatchSchema, CreateBatchDto,
  CreateCategorySchema, CreateCategoryDto,
} from './dto/inventory.dto';
import { z } from 'zod';

const ProductQuerySchema = PaginationSchema.extend({
  type: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  lowStock: z.coerce.boolean().optional(),
});

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ── Categories ────────────────────────────────────────────────────────────
  @Get('categories')
  @ApiOperation({ summary: 'List all active categories' })
  getCategories() {
    return this.inventoryService.getCategories();
  }

  @Post('categories')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Create product category' })
  createCategory(@Body(new ZodValidationPipe(CreateCategorySchema)) dto: CreateCategoryDto) {
    return this.inventoryService.createCategory(dto);
  }

  // ── Products ──────────────────────────────────────────────────────────────
  @Get('products')
  @ApiOperation({ summary: 'List products with optional search/filter' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  getProducts(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(ProductQuerySchema)) query: any,
  ) {
    return this.inventoryService.getProducts(user.storeId, query);
  }

  @Get('products/barcode/:barcode')
  @ApiOperation({ summary: 'Barcode lookup — used by scanner at POS' })
  getByBarcode(@Param('barcode') barcode: string) {
    return this.inventoryService.getProductByBarcode(barcode);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get product by ID' })
  getProductById(@Param('id') id: string) {
    return this.inventoryService.getProductById(id);
  }

  @Post('products')
  @Roles('manager', 'owner', 'stock_officer')
  @ApiOperation({ summary: 'Create product' })
  createProduct(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateProductSchema)) dto: CreateProductDto,
  ) {
    return this.inventoryService.createProduct(dto, user.storeId);
  }

  @Put('products/:id')
  @Roles('manager', 'owner', 'stock_officer')
  @ApiOperation({ summary: 'Update product' })
  updateProduct(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProductSchema)) dto: UpdateProductDto,
  ) {
    return this.inventoryService.updateProduct(id, dto);
  }

  // ── Stock Items ────────────────────────────────────────────────────────────
  @Get('stock/:productId')
  @ApiOperation({ summary: 'Get stock level for product in current store' })
  getStockItem(@Param('productId') productId: string, @CurrentUser() user: JwtPayload) {
    return this.inventoryService.getStockItem(productId, user.storeId);
  }

  // ── Batches ────────────────────────────────────────────────────────────────
  @Get('batches/:productId')
  @ApiOperation({ summary: 'Get all active batches for a product' })
  getBatches(@Param('productId') productId: string, @CurrentUser() user: JwtPayload) {
    return this.inventoryService.getBatches(productId, user.storeId);
  }

  @Get('batches/expiring')
  @ApiOperation({ summary: 'Get expiring batches (default ≤90 days)' })
  getExpiringBatches(
    @CurrentUser() user: JwtPayload,
    @Query('days') days?: string,
  ) {
    return this.inventoryService.getExpiringBatches(user.storeId, days ? parseInt(days) : 90);
  }

  @Post('batches')
  @Roles('manager', 'owner', 'stock_officer')
  @ApiOperation({ summary: 'Receive new stock batch' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        storeId: { type: 'string' },
        supplierId: { type: 'string' },
        purchaseOrderId: { type: 'string' },
        batchNumber: { type: 'string' },
        quantityReceived: { type: 'number' },
        costPricePesewas: { type: 'number' },
        expiryDate: { type: 'string' },
        manufacturedDate: { type: 'string' },
      },
      required: ['productId', 'storeId', 'quantityReceived', 'costPricePesewas']
    }
  })
  createBatch(
    @Body(new ZodValidationPipe(CreateBatchSchema)) dto: CreateBatchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.createBatch(dto, user.sub);
  }

  // ── Adjustments ────────────────────────────────────────────────────────────
  @Post('adjustments')
  @Roles('manager', 'owner', 'stock_officer')
  @ApiOperation({ summary: 'Manual stock adjustment with reason' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        storeId: { type: 'string' },
        batchId: { type: 'string' },
        type: { type: 'string', enum: ['adjustment_in', 'adjustment_out', 'opening_stock'] },
        quantity: { type: 'number' },
        costPricePesewas: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['productId', 'storeId', 'type', 'quantity']
    }
  })
  adjust(
    @Body(new ZodValidationPipe(StockAdjustmentSchema)) dto: StockAdjustmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.adjust(dto, user.sub);
  }

  @Get('movements/:productId')
  @ApiOperation({ summary: 'Stock movement ledger for a product' })
  getMovements(@Param('productId') productId: string, @CurrentUser() user: JwtPayload) {
    return this.inventoryService.getMovements(productId, user.storeId);
  }

  // ── Alerts ─────────────────────────────────────────────────────────────────
  @Get('alerts')
  @ApiOperation({ summary: 'Active stock alerts (low stock, expiry)' })
  getAlerts(@CurrentUser() user: JwtPayload) {
    return this.inventoryService.getAlerts(user.storeId);
  }

  @Patch('alerts/:id/dismiss')
  @Roles('manager', 'owner', 'stock_officer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss a stock alert' })
  dismissAlert(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.inventoryService.dismissAlert(id, user.sub);
  }
}
