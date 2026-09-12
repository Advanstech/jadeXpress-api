import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { z } from 'zod';

const MAX_BASE64_CHARS = 12 * 1024 * 1024; // ~9MB binary — phone photos fit after client-side compression

const UploadImageSchema = z.object({
  base64Image: z.string().min(1).max(MAX_BASE64_CHARS),
  folder: z.string().max(50).optional().default('products'),
});

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @Roles('manager', 'owner', 'stock_officer', 'root')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload an image — returns a CDN URL (Cloudinary) or compressed base64 fallback' })
  async uploadImage(@Body() body: z.infer<typeof UploadImageSchema>) {
    const parsed = UploadImageSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('; ');
      throw new BadRequestException(
        parsed.error.issues.some((i) => i.code === 'too_big')
          ? 'Image too large — compress or resize before uploading'
          : `Invalid upload: ${msg}`,
      );
    }
    const result = await this.uploadsService.uploadImage(parsed.data.base64Image, parsed.data.folder);
    return { success: true, ...result };
  }
}
