import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { z } from 'zod';

const UploadImageSchema = z.object({
  base64Image: z.string().min(1),
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
    const parsed = UploadImageSchema.parse(body);
    const result = await this.uploadsService.uploadImage(parsed.base64Image, parsed.folder);
    return { success: true, ...result };
  }
}
