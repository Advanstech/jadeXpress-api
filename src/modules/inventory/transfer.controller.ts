import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { TransferService } from './transfer.service';
import { CreateTransferDto, TransferApprovalDto, createTransferSchema, transferApprovalSchema } from './dto/transfer.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('Inventory Transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/transfers')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Get()
  @ApiOperation({
    summary: 'List all stock transfers with branch, status, and search filters',
  })
  async listTransfers(
    @CurrentUser() user: JwtPayload,
    @Query('storeId') storeId?: string,
    @Query('fromStoreId') fromStoreId?: string,
    @Query('toStoreId') toStoreId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const elevated = ['owner', 'root', 'super_admin'].includes((user.role || '').toLowerCase());
    return this.transferService.listTransfers({
      storeId: elevated ? storeId : user.storeId,
      fromStoreId,
      toStoreId,
      status,
      search,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get summary metrics of inter-branch stock transfers' })
  async getStats(@CurrentUser() user: JwtPayload, @Query('storeId') storeId?: string) {
    const elevated = ['owner', 'root', 'super_admin'].includes((user.role || '').toLowerCase());
    return this.transferService.getTransferStats(elevated ? storeId : user.storeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific transfer' })
  async getTransferById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const elevated = ['owner', 'root', 'super_admin'].includes((user.role || '').toLowerCase());
    return this.transferService.getTransferById(id, elevated ? undefined : user.storeId);
  }

  @Post()
  @Roles('manager', 'supervisor', 'owner', 'root', 'super_admin', 'pharmacist', 'head_pharmacist', 'stock_officer')
  @ApiOperation({ summary: 'Initiate or immediately execute a stock transfer between branches' })
  async createTransfer(
    @Body(new ZodValidationPipe(createTransferSchema)) data: CreateTransferDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transferService.createTransfer(data, user.sub, user.storeId, user.role);
  }

  @Put(':id/approve')
  @Roles('manager', 'supervisor', 'owner', 'root', 'super_admin')
  @ApiOperation({ summary: 'Approve a stock transfer and sync inventory' })
  async approveTransfer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(transferApprovalSchema)) data: TransferApprovalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transferService.approveTransfer(id, data, user.sub, user.storeId, user.role);
  }

  @Put(':id/reject')
  @Roles('manager', 'supervisor', 'owner', 'root', 'super_admin')
  @ApiOperation({ summary: 'Reject a pending stock transfer' })
  async rejectTransfer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(transferApprovalSchema)) data: TransferApprovalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transferService.rejectTransfer(id, data, user.sub, user.storeId, user.role);
  }
}
