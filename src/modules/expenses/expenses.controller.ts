import { Controller, Get, Post, Put, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationSchema } from '../../common/dto/pagination.dto';
import {
  CreateExpenseCategorySchema, CreateExpenseCategoryDto,
  CreateExpenseSchema, CreateExpenseDto,
  UpdateExpenseSchema, UpdateExpenseDto,
} from './dto/expenses.dto';
import { z } from 'zod';

const ExpenseQuerySchema = PaginationSchema.extend({
  categoryId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

@ApiTags('expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List expense categories for current store' })
  listCategories(@CurrentUser() user: JwtPayload) {
    return this.expensesService.listCategories(user.storeId);
  }

  @Post('categories')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Create custom expense category' })
  createCategory(@Body(new ZodValidationPipe(CreateExpenseCategorySchema)) dto: CreateExpenseCategoryDto) {
    return this.expensesService.createCategory(dto);
  }

  @Get('summary')
  @Roles('manager', 'supervisor', 'owner')
  @ApiOperation({ summary: 'Expense totals grouped by category' })
  getSummary(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.expensesService.getSummaryByCategory(user.storeId, from, to);
  }

  @Get()
  @ApiOperation({ summary: 'List expenses with optional filters' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(ExpenseQuerySchema)) query: any,
  ) {
    return this.expensesService.list(user.storeId, query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.expensesService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Record an expense' })
  create(
    @Body(new ZodValidationPipe(CreateExpenseSchema)) dto: CreateExpenseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.expensesService.create(dto, user.sub);
  }

  @Put(':id')
  @Roles('manager', 'owner')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateExpenseSchema)) dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(id, dto);
  }

  @Patch(':id/approve')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Approve expense (manager sign-off)' })
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.expensesService.approve(id, user.sub);
  }
}
