import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransferService } from './transfer.service';
import { CreateTransferDto, TransferApprovalDto } from './dto/transfer.dto';

@ApiTags('Inventory Transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/transfers')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Get()
  @ApiOperation({ summary: 'List all stock transfers' })
  async listTransfers() {
    return this.transferService.listTransfers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific transfer' })
  async getTransferById(@Param('id') id: string) {
    return this.transferService.getTransferById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Initiate a new stock transfer' })
  async createTransfer(@Body() data: CreateTransferDto, @Req() req: any) {
    return this.transferService.createTransfer(data, req.user?.id);
  }

  @Put(':id/approve')
  @ApiOperation({ summary: 'Approve a stock transfer and sync inventory' })
  async approveTransfer(
    @Param('id') id: string,
    @Body() data: TransferApprovalDto,
    @Req() req: any,
  ) {
    return this.transferService.approveTransfer(id, data, req.user?.id);
  }

  @Put(':id/reject')
  @ApiOperation({ summary: 'Reject a pending stock transfer' })
  async rejectTransfer(
    @Param('id') id: string,
    @Body() data: TransferApprovalDto,
    @Req() req: any,
  ) {
    return this.transferService.rejectTransfer(id, data, req.user?.id);
  }
}
