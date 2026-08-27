import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ProductIntelligenceSchema, ProductIntelligenceDto } from './dto/ai.dto';

const UpsellSchema = z.object({ cartProductIds: z.array(z.string().uuid()) });
const NlSearchSchema = z.object({ query: z.string().min(1) });
const AskSchema = z.object({ question: z.string().min(1) });
const OcrSchema = z.object({
  imageUrl: z.string().optional(),
  base64Image: z.string().optional(),
});
const ExtractProductSchema = z.object({
  imageUrl: z.string().optional(),
  base64Image: z.string().optional(),
  fileName: z.string().optional(),
});
const GenerateImageSchema = z.object({
  productName: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
});
const PerfectImageSchema = z.object({
  imageUrl: z.string().optional(),
  base64Image: z.string().optional(),
  productName: z.string().min(1),
  category: z.string().optional(),
  description: z.string().optional(),
  style: z.enum(['studio_white', 'studio_ambient', 'transparent_png']).optional(),
});

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('forecast')
  @ApiOperation({ summary: '[MOCKED] Demand forecast for a product' })
  forecast(
    @CurrentUser() user: JwtPayload,
    @Query('productId') productId: string,
    @Query('horizonDays') horizonDays?: string,
  ) {
    return this.aiService.demandForecast(productId, user.storeId, horizonDays ? parseInt(horizonDays) : 30);
  }

  @Post('upsell')
  @ApiOperation({ summary: '[MOCKED] Cart upsell/cross-sell recommendations (<150ms budget)' })
  upsell(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(UpsellSchema)) body: { cartProductIds: string[] },
  ) {
    return this.aiService.upsellRecommendations(body.cartProductIds, user.storeId);
  }

  @Post('customer-search')
  @ApiOperation({ summary: '[MOCKED] Natural-language customer search → structured filters' })
  customerSearch(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(NlSearchSchema)) body: { query: string },
  ) {
    return this.aiService.customerNlSearch(body.query, user.storeId);
  }

  @Get('anomalies')
  @ApiOperation({ summary: '[MOCKED] Anomaly detection on EOD variance and expenses' })
  detectAnomalies(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.aiService.detectAnomalies(user.storeId, from, to);
  }

  @Post('ask')
  @ApiOperation({ summary: '[MOCKED] "Ask the shop" natural-language Q&A widget' })
  ask(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(AskSchema)) body: { question: string },
  ) {
    return this.aiService.askTheShop(body.question, user.storeId);
  }

  @Public()
  @Post('ocr')
  @ApiOperation({ summary: 'OCR extraction from supplier invoice/receipt image' })
  ocr(@Body(new ZodValidationPipe(OcrSchema)) body: { imageUrl?: string; base64Image?: string }) {
    return this.aiService.ocrExtract(body.imageUrl || body.base64Image || '');
  }

  @Post('extract-product')
  @ApiOperation({ summary: 'Vision AI product extraction from uploaded product packaging or label photo' })
  async extractProduct(
    @Body(new ZodValidationPipe(ExtractProductSchema))
    body: { imageUrl?: string; base64Image?: string; fileName?: string },
  ) {
    try {
      return await this.aiService.extractProductFromImage(body.imageUrl, body.base64Image, body.fileName);
    } catch (err: any) {
      throw new BadRequestException(err?.message ?? 'Product extraction failed');
    }
  }

  @Post('generate-image')
  @ApiOperation({ summary: 'Generate product image using AI Imagen / DALL-E 3' })
  async generateImage(
    @Body(new ZodValidationPipe(GenerateImageSchema))
    body: { productName: string; description?: string; category?: string },
  ) {
    try {
      return await this.aiService.generateProductImage(body.productName, body.description, body.category);
    } catch (err: any) {
      throw new BadRequestException(err?.message ?? 'Image generation failed');
    }
  }

  @Post('product-intelligence')
  @ApiOperation({
    summary:
      'Counter guidance for a catalogue item — adapts to supplements, beauty, medicines, equipment',
  })
  async productIntelligence(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(ProductIntelligenceSchema)) body: ProductIntelligenceDto,
  ) {
    return this.aiService.getProductIntelligence(body.productId, user.storeId);
  }

  @Post('perfect-image')
  @ApiOperation({ summary: 'Perfect & enhance product photo into pristine white background studio product shot' })
  async perfectImage(
    @Body(new ZodValidationPipe(PerfectImageSchema))
    body: {
      imageUrl?: string;
      base64Image?: string;
      productName: string;
      category?: string;
      description?: string;
      style?: 'studio_white' | 'studio_ambient' | 'transparent_png';
    },
  ) {
    try {
      return await this.aiService.perfectProductImage(body);
    } catch (err: any) {
      throw new BadRequestException(err?.message ?? 'Image perfecting failed');
    }
  }
}
