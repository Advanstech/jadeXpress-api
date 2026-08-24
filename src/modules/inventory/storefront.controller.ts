import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationSchema } from '../../common/dto/pagination.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const ProductQuerySchema = PaginationSchema.extend({
  type: z.string().optional(),
  categoryId: z.string().uuid().optional(),
});

@ApiTags('storefront')
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Public category list for the storefront' })
  getPublicCategories() {
    return this.inventoryService.getPublicCategories();
  }

  @Public()
  @Get('products')
  @ApiOperation({ summary: 'Public product catalog for the storefront' })
  getPublicProducts(
    @Query(new ZodValidationPipe(ProductQuerySchema)) query: any,
  ) {
    return this.inventoryService.getPublicProducts(query);
  }

  @Public()
  @Get('products/:id')
  @ApiOperation({ summary: 'Public product details for the storefront' })
  getPublicProductById(@Param('id') id: string) {
    return this.inventoryService.getPublicProductById(id);
  }
}
