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
  @Roles('manager', 'supervisor', 'owner')
  @ApiOperation({ summary: 'Process a refund — requires manager PIN authorizedById' })
  create(
    @Body(new ZodValidationPipe(CreateRefundSchema)) dto: CreateRefundDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.refundsService.create(dto, user.sub);
  }
}
