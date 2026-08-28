import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { FastifyRequest } from 'fastify';
import { OrdersService } from './orders.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  CreateOrderSchema, CreateOrderDto,
  UpdateOrderStatusSchema, UpdateOrderStatusDto,
  MarkPaidSchema, MarkPaidDto,
} from './dto/order.dto';

@ApiTags('storefront-orders')
@Controller('storefront/orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly jwtService: JwtService,
  ) {}

  // ── Checkout — works for both guests and signed-in customers ────────────
  @Public()
  @Post()
  @ApiOperation({ summary: 'Place an order (guest or signed-in customer)' })
  async create(
    @Req() req: FastifyRequest,
    @Body(new ZodValidationPipe(CreateOrderSchema)) dto: CreateOrderDto,
  ) {
    await this.ordersService.validateStock(dto.items);
    const customerId = await this.tryExtractCustomerId(req.headers.authorization);
    return this.ordersService.createOrder(customerId, dto);
  }

  @Public()
  @Get('track')
  @ApiOperation({ summary: 'Guest order tracking by order number + email' })
  track(@Query('orderNumber') orderNumber: string, @Query('email') email: string) {
    return this.ordersService.trackOrder(orderNumber, email);
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the current customer\'s orders' })
  listMine(@CurrentUser() user: JwtPayload) {
    return this.ordersService.listByCustomer(user.sub);
  }

  @Get('mine/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get one of the current customer\'s orders' })
  getMine(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ordersService.getOrderForCustomer(id, user.sub);
  }

  // ── Staff / admin ─────────────────────────────────────────────────────────
  @Get()
  @ApiBearerAuth()
  @Roles('supervisor', 'manager', 'owner')
  @ApiOperation({ summary: 'List all storefront orders (staff)' })
  listAll(@Query('status') status?: string) {
    return this.ordersService.listAll(status);
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles('supervisor', 'manager', 'owner')
  @ApiOperation({ summary: 'Get any storefront order by ID (staff)' })
  getById(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }

  @Put(':id/status')
  @ApiBearerAuth()
  @Roles('supervisor', 'manager', 'owner')
  @ApiOperation({ summary: 'Update order fulfillment status (staff)' })
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateOrderStatusSchema)) dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto);
  }

  @Public()
  @Put(':id/pay')
  @ApiOperation({ summary: 'Record payment against an order (public, for gateway callbacks)' })
  markPaid(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MarkPaidSchema)) dto: MarkPaidDto,
  ) {
    return this.ordersService.markPaid(id, dto.reference, dto.gateway, dto.method);
  }

  // Best-effort verification of an optional customer bearer token on the
  // public checkout route so guest and signed-in checkouts share one endpoint.
  private async tryExtractCustomerId(authHeader?: string): Promise<string | null> {
    if (!authHeader?.startsWith('Bearer ')) return null;
    try {
      const payload = await this.jwtService.verifyAsync(authHeader.slice(7));
      return payload?.type === 'customer' ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
