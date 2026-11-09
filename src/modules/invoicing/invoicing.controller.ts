import { Controller, Get, Post, Body, Param, Patch, Query, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InvoicingService } from './invoicing.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('invoicing')
@Controller('invoicing')
export class InvoicingController {
  constructor(private readonly invoicingService: InvoicingService) {}

  private scope(user: JwtPayload, requestedStore?: string) {
    const global = ['root', 'super_admin'].includes(user.role.toLowerCase());
    const storeId = global && requestedStore ? requestedStore : user.storeId;
    if (!storeId) throw new BadRequestException('Select an active branch');
    return { storeId, global };
  }

  @Get()
  @ApiOperation({ summary: 'List invoices for the effective branch, newest first' })
  getInvoices(@CurrentUser() user: JwtPayload, @Query('storeId') storeId?: string) {
    return this.invoicingService.getInvoices(this.scope(user, storeId).storeId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a branch-scoped invoice with product snapshots and creator attribution' })
  createInvoice(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const { storeId, global } = this.scope(user, (body as any)?.storeId);
    return this.invoicingService.createInvoice({ ...(body as object), storeId, createdById: global ? (body as any).createdById : user.sub });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice with items and actor-attributed invoice/payment history' })
  getInvoiceById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const { storeId, global } = this.scope(user);
    return this.invoicingService.getInvoiceById(id, global ? undefined : storeId);
  }

  @Patch(':id/status')
  @Roles('manager', 'supervisor', 'owner', 'root', 'super_admin')
  @ApiOperation({ summary: 'Mark a draft invoice sent or cancel an unpaid invoice' })
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: JwtPayload) {
    const { storeId } = this.scope(user);
    return this.invoicingService.updateInvoiceStatus(id, status, storeId, user.sub);
  }

  @Post(':id/payment')
  @Roles('manager', 'supervisor', 'owner', 'root', 'super_admin')
  @ApiOperation({ summary: 'Record an invoice payment, preserving the branch and recording the actor' })
  recordPayment(@Param('id') id: string, @Body() body: { amountPesewas: number; method?: string; reference?: string }, @Req() request: any, @CurrentUser() user: JwtPayload) {
    const { storeId } = this.scope(user);
    return this.invoicingService.recordPayment(id, body?.amountPesewas, storeId, user.sub, body?.method, body?.reference);
  }
}
