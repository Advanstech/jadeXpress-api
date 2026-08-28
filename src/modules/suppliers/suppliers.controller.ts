import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationSchema } from '../../common/dto/pagination.dto';
import {
  CreateSupplierSchema,
  UpdateSupplierSchema,
  CreatePurchaseOrderSchema,
  ReceiveGoodsSchema,
  PayPurchaseOrderSchema,
  ApprovePurchaseOrderSchema,
} from './dto/suppliers.dto';
import type {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreatePurchaseOrderDto,
  ReceiveGoodsDto,
  PayPurchaseOrderDto,
  ApprovePurchaseOrderDto,
} from './dto/suppliers.dto';

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(PaginationSchema)) query: any) {
    return this.suppliersService.list(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.suppliersService.getById(id);
  }

  @Get(':id/purchase-orders')
  @ApiOperation({ summary: 'List all POs for a specific supplier' })
  getSupplierPOs(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(PaginationSchema)) query: any,
  ) {
    return this.suppliersService.getSupplierPOs(id, query);
  }

  @Get(':id/products')
  @ApiOperation({ summary: 'List all products ever sourced from a supplier' })
  getSupplierProducts(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.suppliersService.getSupplierProducts(id, user.storeId);
  }

  @Post()
  @Roles('manager', 'owner')
  create(@Body(new ZodValidationPipe(CreateSupplierSchema)) dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Put(':id')
  @Roles('manager', 'owner')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateSupplierSchema)) dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Get('purchase-orders/store')
  @ApiOperation({ summary: 'List POs for current store' })
  listPOs(@CurrentUser() user: JwtPayload, @Query(new ZodValidationPipe(PaginationSchema)) query: any) {
    return this.suppliersService.listPurchaseOrders(user.storeId, query);
  }

  @Get('purchase-orders/:id')
  getPO(@Param('id') id: string) {
    return this.suppliersService.getPurchaseOrder(id);
  }

  @Post('purchase-orders')
  @Roles('manager', 'owner', 'stock_officer')
  @ApiOperation({ summary: 'Create purchase order' })
  createPO(
    @Body(new ZodValidationPipe(CreatePurchaseOrderSchema)) dto: CreatePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.suppliersService.createPurchaseOrder(dto, user.sub);
  }

  @Post('purchase-orders/receive')
  @Roles('manager', 'owner', 'stock_officer')
  @ApiOperation({ summary: 'Receive goods against a PO — creates batches + updates stock' })
  receiveGoods(
    @Body(new ZodValidationPipe(ReceiveGoodsSchema)) dto: ReceiveGoodsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.suppliersService.receiveGoods(dto, user.sub);
  }

  @Post('purchase-orders/:id/pay')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Record a payment against a purchase order' })
  payPurchaseOrder(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PayPurchaseOrderSchema)) dto: PayPurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.suppliersService.payPurchaseOrder(id, dto, user.sub);
  }

  @Put('purchase-orders/:id/approve')
  @Roles('manager', 'owner', 'supervisor')
  @ApiOperation({ summary: 'Approve a purchase order' })
  approvePurchaseOrder(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ApprovePurchaseOrderSchema)) dto: ApprovePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.suppliersService.approvePurchaseOrder(id, user.sub, dto.notes);
  }

  @Put('purchase-orders/:id/reject')
  @Roles('manager', 'owner', 'supervisor')
  @ApiOperation({ summary: 'Reject a purchase order' })
  rejectPurchaseOrder(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ApprovePurchaseOrderSchema)) dto: ApprovePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.suppliersService.rejectPurchaseOrder(id, user.sub, dto.notes);
  }
}
