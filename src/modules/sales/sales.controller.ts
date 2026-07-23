import {
  Controller, Get, Post, Patch, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationSchema } from '../../common/dto/pagination.dto';
import {
  CreateSaleSchema, CreateSaleDto,
  HoldSaleSchema, HoldSaleDto,
  VoidSaleSchema, VoidSaleDto,
} from './dto/sales.dto';
import { z } from 'zod';

const SaleQuerySchema = PaginationSchema.extend({
  from: z.string().optional(),
  to: z.string().optional(),
  cashierId: z.string().uuid().optional(),
  status: z.string().optional(),
});

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create sale — POS checkout (idempotent via clientId)' })
  createSale(
    @Body(new ZodValidationPipe(CreateSaleSchema)) dto: CreateSaleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.createSale(dto, user.sub);
  }

  @Get('held')
  @ApiOperation({ summary: 'List held (paused) sales for current store' })
  getHeldSales(@CurrentUser() user: JwtPayload) {
    return this.salesService.getHeldSales(user.storeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sale by ID with line items' })
  getSale(@Param('id') id: string) {
    return this.salesService.getSaleById(id);
  }

  @Get()
  @ApiOperation({ summary: 'List sales with filters' })
  listSales(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(SaleQuerySchema)) query: any,
  ) {
    return this.salesService.listSales(user.storeId, query);
  }

  @Patch('hold')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hold (pause) a sale in progress' })
  holdSale(@Body(new ZodValidationPipe(HoldSaleSchema)) dto: HoldSaleDto) {
    return this.salesService.holdSale(dto);
  }

  @Patch('void')
  @Roles('manager', 'supervisor', 'owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void a sale (manager/supervisor only)' })
  voidSale(
    @Body(new ZodValidationPipe(VoidSaleSchema)) dto: VoidSaleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.voidSale(dto, user.sub);
  }

  @Patch(':id/receipt-printed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark receipt as printed' })
  markReceiptPrinted(@Param('id') id: string) {
    return this.salesService.markReceiptPrinted(id);
  }
}
