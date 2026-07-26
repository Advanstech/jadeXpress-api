import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { InvoicingService } from './invoicing.service';

@Controller('invoicing')
export class InvoicingController {
  constructor(private readonly invoicingService: InvoicingService) {}

  @Get()
  getInvoices(@Query('storeId') storeId: string) {
    if (!storeId) throw new Error('storeId is required');
    return this.invoicingService.getInvoices(storeId);
  }

  @Post()
  createInvoice(@Body() body: any) {
    return this.invoicingService.createInvoice(body);
  }

  @Get(':id')
  getInvoiceById(@Param('id') id: string) {
    return this.invoicingService.getInvoiceById(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.invoicingService.updateInvoiceStatus(id, status);
  }

  @Post(':id/payment')
  recordPayment(@Param('id') id: string, @Body('amountPesewas') amountPesewas: number) {
    return this.invoicingService.recordPayment(id, amountPesewas);
  }
}
