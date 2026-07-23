import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PaginationSchema } from '../../common/dto/pagination.dto';
import {
  CreateCustomerSchema, CreateCustomerDto,
  UpdateCustomerSchema, UpdateCustomerDto,
  NlSearchSchema, NlSearchDto,
} from './dto/customers.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'List customers' })
  list(@Query(new ZodValidationPipe(PaginationSchema)) query: any) {
    return this.customersService.list(query);
  }

  @Get('lapsed')
  @ApiOperation({ summary: 'Customers who haven\'t visited in N days (default 60)' })
  getLapsed(@CurrentUser() user: JwtPayload, @Query('days') days?: string) {
    return this.customersService.getLapsedCustomers(user.storeId, days ? parseInt(days) : 60);
  }

  @Post('nl-search')
  @ApiOperation({ summary: 'Natural-language customer search (fallback filter; full NL at /ai/customer-search)' })
  nlSearch(@Body(new ZodValidationPipe(NlSearchSchema)) dto: NlSearchDto) {
    return this.customersService.nlSearch(dto.query, dto.storeId);
  }

  @Get('phone/:phone')
  @ApiOperation({ summary: 'Look up customer by phone (quick POS lookup)' })
  getByPhone(@Param('phone') phone: string) {
    return this.customersService.getByPhone(phone);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  getById(@Param('id') id: string) {
    return this.customersService.getById(id);
  }

  @Get(':id/purchases')
  @ApiOperation({ summary: 'Customer purchase history' })
  getPurchaseHistory(@Param('id') id: string) {
    return this.customersService.getPurchaseHistory(id);
  }

  @Get(':id/loyalty')
  @ApiOperation({ summary: 'Customer loyalty transaction history' })
  getLoyalty(@Param('id') id: string) {
    return this.customersService.getLoyaltyTransactions(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create customer' })
  create(@Body(new ZodValidationPipe(CreateCustomerSchema)) dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update customer' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCustomerSchema)) dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, dto);
  }
}
