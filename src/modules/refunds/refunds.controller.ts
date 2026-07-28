import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RefundsService } from './refunds.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationSchema } from '../../common/dto/pagination.dto';
import { CreateRefundSchema, CreateRefundDto } from './dto/refunds.dto';

@ApiTags('refunds')
@ApiBearerAuth()
@Controller('refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get()
  @ApiOperation({ summary: 'List refunds for current store' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(PaginationSchema)) query: any,
  ) {
    return this.refundsService.list(user.storeId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get refund details with line items' })
  getById(@Param('id') id: string) {
    return this.refundsService.getById(id);
  }

  @Post()
  @Roles('manager', 'supervisor', 'owner', 'cashier', 'pharmacist')
  @ApiOperation({ summary: 'Process a refund — requires manager PIN authorizedById for immediate processing' })
  create(
    @Body(new ZodValidationPipe(CreateRefundSchema)) dto: CreateRefundDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.refundsService.create(dto, user);
  }

  @Post(':id/approve')
  @Roles('manager', 'owner', 'supervisor')
  @ApiOperation({ summary: 'Approve a pending refund request' })
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.refundsService.approve(id, user.sub);
  }

  @Post(':id/reject')
  @Roles('manager', 'owner', 'supervisor')
  @ApiOperation({ summary: 'Reject a pending refund request' })
  reject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.refundsService.reject(id, user.sub);
  }
}
