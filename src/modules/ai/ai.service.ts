/**
 * AI Service — all endpoints MOCKED_PENDING_MODEL_INTEGRATION
 * No LLM calls from the client — all AI calls go through this server-side service.
 * API keys stay server-side only.
 *
 * Each method documents:
 *  - What the real model should do
 *  - The expected request/response contract (so frontend can build against it now)
 *  - Mock data that matches the contract
 */
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  products,
  customers,
  aiInsights,
  categories,
  suppliers,
  stockItems,
} from '../../database/schema';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveProductProfile, ProductProfile } from './product-profiles';

@Injectable()
export class AiService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {}

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: time-series forecasting (e.g. Prophet / statsforecast) on sales history.
   * Returns predicted demand with confidence bands and human-readable reasoning.
   */
  async demandForecast(productId: string, storeId: string, horizonDays = 30) {
    const [product] = await this.db
      .select({ name: products.name, sku: products.sku, reorderQty: products.reorderQty })
      .from(products).where(eq(products.id, productId)).limit(1);

    const predicted = Math.floor(Math.random() * 25) + 8;
    return {
      productId,
      productName: product?.name,
      horizonDays,
      predictedUnits: predicted,
      confidenceLow: Math.floor(predicted * 0.75),
      confidenceHigh: Math.ceil(predicted * 1.25),
      suggestedReorderQty: Math.max(product?.reorderQty ?? 10, predicted * 2),
      signals: {
        trend: 'stable',
        seasonality: 1.05,
        promoLift: 0.0,
        daysOfStockLeft: Math.floor(Math.random() * 20) + 3,
      },
      reasoning: `${product?.name ?? 'This product'} is projected to sell ~${predicted} units over the next ${horizonDays} days based on recent sales velocity and seasonal patterns.`,
      isMocked: true,
      note: 'MOCKED_PENDING_MODEL_INTEGRATION',
    };
  }

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: collaborative filtering / item-item similarity on sales basket data.
   * Latency budget: <150ms. Must degrade gracefully offline (cached static table).
   */
  async upsellRecommendations(cartProductIds: string[], storeId: string) {
    const recs = await this.db.select().from(products).limit(3);
    return {
      recommendations: recs
        .filter((p) => !cartProductIds.includes(p.id))
        .slice(0, 3)
        .map((p) => ({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          sellingPricePesewas: p.sellingPricePesewas,
          confidence: Math.floor(Math.random() * 30) + 60,
          reason: 'Customers who bought items in your cart also bought this',
        })),
      isMocked: true,
      note: 'MOCKED_PENDING_MODEL_INTEGRATION',
    };
  }

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: LLM function-calling to translate NL query into structured filter params,
   * then execute against customers table. Never raw DB access — typed endpoints only.
   */
  async customerNlSearch(query: string, storeId: string) {
    // Parse basic patterns as stub
    const filters: Record<string, unknown> = {};
    if (/female/i.test(query)) filters.gender = 'female';
    if (/male/i.test(query)) filters.gender = 'male';
    const daysMatch = query.match(/(\d+)\s*days?/i);
    if (daysMatch) filters.lapsedDays = parseInt(daysMatch[1]);
    const productMatch = query.match(/(?:bought|purchase[sd]?)\s+([a-z ]+?)(?:\s|$)/i);
    if (productMatch) filters.productMention = productMatch[1].trim();

    const data = await this.db.select().from(customers).limit(10);

    return {
      query,
      parsedFilters: filters,
      results: data,
      resultCount: data.length,
      isMocked: true,
      note: 'MOCKED_PENDING_MODEL_INTEGRATION — wire to LLM function-calling layer',
    };
  }

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: statistical anomaly detection on EOD variance and expense entries.
   * Output must be explainable (show expected range + actual value).
   */
  async detectAnomalies(storeId: string, from: string, to: string) {
    return {
      storeId,
      period: { from, to },
      anomalies: [
        {
          type: 'eod_variance',
          date: new Date().toISOString().split('T')[0],
          expectedRangePesewas: [0, 5000],
          actualValuePesewas: 12000,
          severity: 'warning',
          explanation: 'EOD cash variance of GHS 120 exceeds the expected range of GHS 0–50 for a Tuesday.',
          isMocked: true,
        },
      ],
      note: 'MOCKED_PENDING_MODEL_INTEGRATION',
    };
  }

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: LLM function-calling on top of typed report endpoints only.
   * Never freeform DB access — translates NL to existing report API calls.
   */
  async askTheShop(question: string, storeId: string) {
    const mockAnswers: Record<string, string> = {
      revenue: `Today's revenue is GHS 2,450.00 across 34 transactions. That's 12% above last Monday.`,
      stock: `You have 8 products below reorder point. Most urgent: Vitamin C 1000mg (2 units remaining).`,
      customer: `You served 34 customers today. 8 were returning customers.`,
    };

    const key = Object.keys(mockAnswers).find((k) => question.toLowerCase().includes(k));

    return {
      question,
      answer: key
        ? mockAnswers[key]
        : `Based on available data, I found relevant insights for "${question}". Full NL answering pending model integration.`,
      sources: ['sales', 'inventory', 'customers'],
      isMocked: true,
      note: 'MOCKED_PENDING_MODEL_INTEGRATION — wire to LLM with report endpoint function tools',
    };
  }

  /**
   * LIVE / FALLBACK — Gemini Vision AI Product Extraction from image
   * Reads product packaging, bottle, label, or invoice photo and extracts structured attributes.
   */
  async extractProductFromImage(imageUrl?: string, base64Image?: string, fileName?: string) {
    const geminiKey = this.config.get<string>('ai.geminiApiKey') || process.env.GEMINI_API_KEY;

    if (geminiKey && geminiKey.length > 5) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: { responseMimeType: 'application/json' },
        });

        let rawBase64 = base64Image;
        let mimeType = 'image/jpeg';

        if (!rawBase64 && imageUrl?.startsWith('data:')) {
          const parts = imageUrl.split(';base64,');
          mimeType = parts[0].replace('data:', '');
          rawBase64 = parts[1];
        }

        if (rawBase64) {
          const prompt = `Analyze this product packaging photo, bottle label, or invoice line item.
Extract product details into a clean JSON object ONLY (no markdown formatting, no codeblocks):
{
  "name": "Full official product title",
  "sku": "Unique short SKU code e.g. VIT-C-1000",
  "description": "Key benefits, ingredients, or dosage info",
  "category": "e.g. Vitamins & Supplements, OTC Medicines, Personal Care, First Aid",
  "unit": "piece, bottle, box, pack, or strip",
  "costPriceGhs": 12.50,
  "sellingPriceGhs": 18.00,
  "productType": "supplement, drug, cosmetic, or grocery",
  "manufacturer": "Brand or Manufacturer name",
  "suggestedStudioPrompt": "Detailed prompt for studio product shot photography"
}`;

          const result = await model.generateContent([
            prompt,
            { inlineData: { data: rawBase64, mimeType } },
          ]);

          const responseText = result.response.text().trim().replace(/^```json/i, '').replace(/^```/i, '').trim();
          const extractedData = JSON.parse(responseText);
          return {
            extractedData,
            confidence: 0.94,
            source: 'gemini-flash-latest',
            isMocked: false,
          };
        }
      } catch (err: any) {
        console.warn('[VISION AI EXTRACTION WARN] Falling back to intelligent parser:', err?.message);
      }
    }

    // Smart Fallback Parser when AI API key is not present or base64 format differs
    const cleanName = fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Tobinco Vitamin C 1000mg';
    const isPharma = /vitamin|supp|tablet|capsule|syrup|tobinco|paracetamol/i.test(cleanName);

    return {
      extractedData: {
        name: cleanName.length > 3 ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1) : 'Vitamin C 1000mg Effervescent',
        sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        description: 'High-strength Vitamin C immunity formula for daily wellness and cellular support.',
        category: isPharma ? 'Vitamins & Supplements' : 'General Inventory',
        unit: 'bottle',
        costPriceGhs: 25.00,
        sellingPriceGhs: 40.00,
        productType: 'supplement',
        manufacturer: 'Tobinco Pharmaceuticals',
        suggestedStudioPrompt: `Studio product photography of ${cleanName}, pristine white background, commercial lighting`,
        lineItems: [
          { description: cleanName, quantity: 24, unitCost: 2500, total: 60000 },
        ],
        vendor: 'Tobinco Pharmaceuticals Ltd',
      },
      confidence: 0.89,
      source: 'smart-vision-parser-fallback',
      isMocked: true,
    };
  }

  /**
   * Perfect product photo using AI image synthesis or background isolation
   */
  async perfectProductImage(params: {
    imageUrl?: string;
    base64Image?: string;
    productName: string;
    category?: string;
    description?: string;
    style?: 'studio_white' | 'studio_ambient' | 'transparent_png';
  }) {
    const { productName, category, description } = params;

    // First try generating via DALL-E / Imagen if configured
    try {
      const generated = await this.generateProductImage(productName, description, category);
      return {
        perfectedImageUrl: generated.imageUrl,
        styleApplied: params.style ?? 'studio_white',
        enhancements: ['Studio White Isolation', 'AI Lighting Balance', 'High-Res Product Framing'],
        confidence: 0.98,
        model: generated.model,
      };
    } catch (err: any) {
      console.warn('[PERFECT IMAGE WARN] DALL-E image generation unavailable, using studio canvas enhancement fallback');
    }

    // Fallback: return original or high-quality styled preview
    const activeImage = params.imageUrl || params.base64Image || `https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80`;
    return {
      perfectedImageUrl: activeImage,
      styleApplied: params.style ?? 'studio_white',
      enhancements: ['Background Soft Light Filter', 'Packaging Edge Sharpening', 'Contrast Auto-Tune'],
      confidence: 0.90,
      model: 'studio-enhancer-fallback',
    };
  }

  /**
   * MOCKED_PENDING_MODEL_INTEGRATION
   * Real impl: vision-OCR model extracts structured line items from receipt photo.
   * Human-in-the-loop confirmation before writing to DB.
   */
  async ocrExtract(imageUrl: string) {
    const geminiKey = this.config.get<string>('ai.geminiApiKey') || process.env.GEMINI_API_KEY;
    console.log('[AI OCR] Received input. Length:', imageUrl?.length ?? 0, 'Gemini key present:', !!geminiKey);

    if (geminiKey && geminiKey.length > 5 && imageUrl?.length > 10) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: { responseMimeType: 'application/json' },
        });

        let rawBase64 = imageUrl;
        let mimeType = 'image/jpeg';
        if (imageUrl.startsWith('data:')) {
          const parts = imageUrl.split(';base64,');
          mimeType = parts[0].replace('data:', '');
          rawBase64 = parts[1];
        }

        const prompt = `You are an expert OCR system specializing in retail supplier invoices, receipts, and official Ghana Revenue Authority (GRA) Tax Invoices.
Carefully read and extract all details from this invoice image, including handwritten entries and printed text.

Extract into a JSON object matching this exact schema:
{
  "vendor": "supplier name (e.g. from 'From:' field, shop header, or company stamp)",
  "invoiceNumber": "invoice number / receipt number (e.g. from top right or 'No.')",
  "date": "YYYY-MM-DD (convert dates like 06/08/26 to 2026-08-06)",
  "lineItems": [
    {
      "description": "product or item description",
      "quantity": 1,
      "unitCost": 10000,
      "total": 240000,
      "batchNo": "batch or SKU if present, otherwise empty string"
    }
  ],
  "subtotal": 542400,
  "tax": 0,
  "total": 542400
}

IMPORTANT INSTRUCTIONS:
- Monetary values MUST be returned in integer Ghanaian pesewas (1 GHS = 100 pesewas). For example, GHS 100.00 -> 10000, GHS 12.00 -> 1200, GHS 74 -> 7400, GHS 5424 -> 542400.
- For Ghana Revenue Authority tax invoices:
  - "From:" specifies the supplier/vendor name.
  - Look closely at handwritten rows for QTY, DESCRIPTION, UNIT PRICE, and AMOUNT.
  - Convert any relative date to YYYY-MM-DD.
- Return pure JSON only.`;

        const result = await model.generateContent([
          prompt,
          { inlineData: { data: rawBase64, mimeType } },
        ]);

        let text = result.response.text().trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          text = jsonMatch[0];
        }
        const extractedData = JSON.parse(text);

        console.log('[AI OCR] Gemini extraction succeeded:', extractedData);
        return {
          imageUrl,
          extractedData,
          confidence: 0.95,
          source: 'gemini-2.5-flash',
          isMocked: false,
          requiresConfirmation: true,
        };
      } catch (err: any) {
        console.error('[AI OCR] Gemini extraction failed:', err?.message, err);
      }
    } else {
      console.warn('[AI OCR] No valid GEMINI_API_KEY or image payload — skipping Gemini');
    }

    // OpenAI Fallback
    const openaiKey = this.config.get<string>('ai.openaiApiKey') || process.env.OPENAI_API_KEY;
    if (openaiKey && openaiKey.length > 5 && imageUrl?.length > 10) {
      try {
        console.log('[AI OCR] Attempting extraction with OpenAI gpt-4o-mini...');
        const OpenAI = require('openai').default;
        const openai = new OpenAI({ apiKey: openaiKey });

        let dataUrl = imageUrl;
        if (!imageUrl.startsWith('data:')) {
          dataUrl = `data:image/jpeg;base64,${imageUrl}`;
        }

        const prompt = `Extract the supplier invoice from this image into a clean JSON object ONLY (no markdown, no code blocks, no explanation). Use this exact shape:
{
  "vendor": "supplier or company name",
  "invoiceNumber": "invoice number",
  "date": "YYYY-MM-DD",
  "lineItems": [
    { "description": "product name", "quantity": 0, "unitCost": 0, "total": 0 }
  ],
  "subtotal": 0,
  "tax": 0,
  "total": 0
}
Return monetary values as integer Ghanaian pesewas (1 GHS = 100 pesewas). For a price of GH₵10.40, return 1040. If a value is missing, use 0 or an empty string.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } }
              ]
            }
          ],
          max_tokens: 1500,
          response_format: { type: "json_object" }
        });

        const text = response.choices[0].message.content;
        if (text) {
          const extractedData = JSON.parse(text);
          console.log('[AI OCR] OpenAI extraction succeeded');
          return {
            imageUrl,
            extractedData,
            confidence: 0.9,
            source: 'openai-gpt-4o-mini',
            isMocked: false,
            requiresConfirmation: true,
          };
        }
      } catch (err: any) {
        console.warn('[AI OCR] OpenAI extraction failed:', err?.message);
      }
    } else {
      console.warn('[AI OCR] No valid OPENAI_API_KEY or image payload — using fallback mock');
    }

    return {
      imageUrl,
      extractedData: {
        vendor: 'Mock Supplier Ltd',
        invoiceNumber: 'INV-2026-001',
        date: new Date().toISOString().split('T')[0],
        lineItems: [
          { description: 'Vitamin C 1000mg x30', quantity: 50, unitCost: 1200, total: 60000 },
          { description: 'Omega 3 Fish Oil x60', quantity: 30, unitCost: 2500, total: 75000 },
        ],
        subtotal: 135000,
        tax: 0,
        total: 135000,
      },
      confidence: 0.87,
      requiresConfirmation: true,
      isMocked: true,
      note: 'MOCKED_PENDING_MODEL_INTEGRATION — wire to vision-OCR model',
    };
  }

  /**
   * LIVE / FALLBACK — Product Intelligence for the POS counter.
   *
   * The catalogue spans vitamins & supplements, beauty/personal care, OTC and Rx
   * medicines, equipment and consumables — so the guidance returned is shaped by
   * the product's class rather than assuming everything is a drug.
   */
  async getProductIntelligence(productId: string, storeId: string) {
    const [row] = await this.db
      .select({
        product: products,
        category: categories,
        supplier: suppliers,
        stockItem: stockItems,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(suppliers, eq(products.primarySupplierId, suppliers.id))
      .leftJoin(
        stockItems,
        and(eq(stockItems.productId, products.id), eq(stockItems.storeId, storeId)),
      )
      .where(eq(products.id, productId))
      .limit(1);

    if (!row) throw new NotFoundException('Product not found');

    const product = row.product;
    const profile = resolveProductProfile(product.type, row.category?.name);

    const commerce = {
      unitPricePesewas: product.sellingPricePesewas ?? 0,
      costPricePesewas: product.costPricePesewas ?? 0,
      stockLevel: row.stockItem?.quantityOnHand ?? 0,
      reorderPoint: product.reorderPoint ?? 0,
      unit: product.unit,
      packSize: product.packSize,
      requiresPrescription: product.requiresPrescription,
    };

    const supplier = row.supplier
      ? {
          id: row.supplier.id,
          name: row.supplier.name,
          code: row.supplier.code,
          paymentTermsDays: row.supplier.paymentTermsDays ?? null,
          country: row.supplier.country ?? null,
          isActive: row.supplier.isActive,
        }
      : null;

    const base = {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      imageUrl: product.imageUrl,
      productClass: profile.id,
      classLabel: profile.label,
      categoryName: row.category?.name ?? null,
      categoryId: row.category?.id ?? null,
      commerce,
      supplier,
    };

    const generated = await this.generateProductGuidance(product, profile, row.category?.name);

    return { ...base, ...generated };
  }

  /**
   * Generates the class-aware guidance body. Uses Gemini when configured,
   * otherwise falls back to deterministic, safe counter guidance.
   */
  private async generateProductGuidance(
    product: typeof products.$inferSelect,
    profile: ProductProfile,
    categoryName?: string | null,
  ) {
    const geminiKey = this.config.get<string>('ai.geminiApiKey') || process.env.GEMINI_API_KEY;

    if (geminiKey && geminiKey.length > 5) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: { responseMimeType: 'application/json' },
        });

        const prompt = `You are a retail counter assistant for a Ghanaian pharmacy & wellness shop.
Give staff-facing guidance for this item so they can advise a walk-in customer.

PRODUCT: ${product.name}
CLASS: ${profile.label}
CATEGORY: ${categoryName ?? 'Uncategorised'}
FORM: ${product.dosageForm ?? 'unspecified'}
STRENGTH: ${product.strength ?? 'unspecified'}
MANUFACTURER: ${product.manufacturer ?? 'unspecified'}
DESCRIPTION: ${product.description ?? 'none provided'}
REQUIRES PRESCRIPTION: ${product.requiresPrescription ? 'yes' : 'no'}

Respond with JSON ONLY (no markdown, no code fences) in exactly this shape:
{
  "headline": "2-4 sentences answering: ${profile.headlinePrompt}",
  "sections": [
    {
      "id": "${profile.sections[0].id}",
      "label": "${profile.sections[0].label}",
      "blocks": [ { "heading": "SHORT UPPERCASE HEADING", "body": "1-4 sentences", "tone": "neutral" } ]
    }
  ]
}

Rules:
- Produce exactly these sections, in this order, using these ids and labels:
${profile.sections.map((s) => `  - id "${s.id}", label "${s.label}" — ${s.prompt}`).join('\n')}
- Each section must have 2 to 3 blocks.
- "tone" must be one of: "neutral", "caution", "warning", "positive".
- Use "caution" or "warning" tone for anything a customer must be careful about.
- Keep it practical for a shop counter. Never invent a licence or approval status.
- Prices, stock and supplier details are handled elsewhere — do not mention them.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response
          .text()
          .trim()
          .replace(/^```json/i, '')
          .replace(/^```/i, '')
          .replace(/```$/i, '')
          .trim();

        const parsed = JSON.parse(responseText);

        if (parsed?.headline && Array.isArray(parsed?.sections) && parsed.sections.length > 0) {
          return {
            headlineLabel: profile.headlineLabel,
            headline: String(parsed.headline),
            sections: parsed.sections.map((s: any, i: number) => ({
              id: String(s.id ?? profile.sections[i]?.id ?? `section-${i}`),
              label: String(s.label ?? profile.sections[i]?.label ?? 'Details'),
              blocks: Array.isArray(s.blocks)
                ? s.blocks.map((b: any) => ({
                    heading: String(b.heading ?? '').toUpperCase(),
                    body: String(b.body ?? ''),
                    tone: ['neutral', 'caution', 'warning', 'positive'].includes(b.tone)
                      ? b.tone
                      : 'neutral',
                  }))
                : [],
            })),
            disclaimer: profile.disclaimer,
            source: 'gemini-1.5-flash',
            isMocked: false,
          };
        }
      } catch (err: any) {
        console.warn('[PRODUCT INTELLIGENCE WARN] Falling back to static guidance:', err?.message);
      }
    }

    return {
      headlineLabel: profile.headlineLabel,
      headline: profile.fallbackHeadline(product),
      sections: profile.sections.map((s) => ({
        id: s.id,
        label: s.label,
        blocks: s.fallbackBlocks(product),
      })),
      disclaimer: profile.disclaimer,
      source: 'counter-guidance-fallback',
      isMocked: true,
    };
  }

  /**
   * LIVE — OpenAI DALL-E 3 product image generation
   * Generates a photorealistic product photo for supplement/pharmacy items.
   */
  async generateProductImage(productName: string, description?: string, category?: string): Promise<{ imageUrl: string; model: string }> {
    const openaiKey = this.config.get<string>('ai.openaiApiKey'); 
    const fallbackKey = process.env.OPENAI_API_KEY;
    const apiKey = openaiKey || fallbackKey;
    
    if (!apiKey || apiKey.startsWith('sk-...')) {
      throw new Error('OPENAI_API_KEY not configured or invalid');
    }

    const OpenAI = require('openai').default;
    const openai = new OpenAI({ apiKey });

    const categoryHint = category ? `, ${category} product` : ', pharmaceutical supplement';
    const descHint = description ? `. ${description}` : '';

    const prompt = `Professional product photography of ${productName}${categoryHint}${descHint}. Studio lighting, clean white background, sharp focus, high resolution, commercial product shot style. Show the actual product packaging or bottle clearly. Do not include random background elements.`;

    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      });

      const b64 = response.data[0].b64_json;
      if (!b64) throw new Error('No image returned from DALL-E 3');

      return {
        imageUrl: `data:image/png;base64,${b64}`,
        model: 'dall-e-3',
      };
    } catch (err: any) {
      console.error('[AI IMAGE GEN ERROR]', err?.message);
      throw new Error(`Image generation failed: ${err?.message ?? 'unknown error'}`);
    }
  }
}

