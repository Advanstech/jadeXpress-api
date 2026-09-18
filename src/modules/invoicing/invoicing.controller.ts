import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { InvoicingService } from './invoicing.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('invoicing')
export class InvoicingController {
  constructor(private readonly invoicingService: InvoicingService) {}

  @Get()
  getInvoices(@CurrentUser() user: JwtPayload, @Query('storeId') storeId?: string) {
    // Only root/super_admin may query a store other than their own.
    const isGlobal = ['root', 'super_admin'].includes(user.role?.toLowerCase());
    const effectiveStoreId = isGlobal && storeId ? storeId : user.storeId;
    return this.invoicingService.getInvoices(effectiveStoreId);
  }

  @Post()
  createInvoice(@Body() body: any, @CurrentUser() user: JwtPayload) {
    const isGlobal = ['root', 'super_admin'].includes(user.role?.toLowerCase());
    if (!isGlobal) {
      body.storeId = user.storeId;
      body.createdById = user.sub;
    }
    return this.invoicingService.createInvoice(body);
  }

  @Get(':id')
  getInvoiceById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const isGlobal = ['root', 'super_admin'].includes(user.role?.toLowerCase());
    return this.invoicingService.getInvoiceById(id, isGlobal ? undefined : user.storeId);
  }

  @Patch(':id/status')
  @Roles('manager', 'supervisor', 'owner')
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: JwtPayload) {
    const isGlobal = ['root', 'super_admin'].includes(user.role?.toLowerCase());
    return this.invoicingService.updateInvoiceStatus(id, status, isGlobal ? undefined : user.storeId);
  }

  @Post(':id/payment')
  @Roles('manager', 'supervisor', 'owner')
  recordPayment(@Param('id') id: string, @Body('amountPesewas') amountPesewas: number, @CurrentUser() user: JwtPayload) {
    const isGlobal = ['root', 'super_admin'].includes(user.role?.toLowerCase());
    return this.invoicingService.recordPayment(id, amountPesewas, isGlobal ? undefined : user.storeId);
  }
}
