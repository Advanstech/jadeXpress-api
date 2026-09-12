import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

@Injectable()
export class UploadsService {
  private cloudinaryConfigured = false;

  constructor(private readonly config: ConfigService) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
      this.cloudinaryConfigured = true;
    }
  }

  isCloudinaryConfigured() {
    return this.cloudinaryConfigured;
  }

  /**
   * Upload an image to Cloudinary (or return compressed base64 as fallback).
   * Accepts a base64 data URL or raw base64 string.
   */
  async uploadImage(base64OrDataUrl: string, folder = 'products'): Promise<{ url: string; provider: string }> {
    // Extract raw base64 + mime type from data URL
    let rawBase64 = base64OrDataUrl;
    let mimeType = 'image/jpeg';

    if (base64OrDataUrl.startsWith('data:')) {
      const parts = base64OrDataUrl.split(';base64,');
      if (parts.length === 2) {
        mimeType = parts[0].replace('data:', '');
        rawBase64 = parts[1];
      }
    }

    const buffer = Buffer.from(rawBase64, 'base64');

    // PDFs (scanned invoices) can't go through sharp — upload raw.
    if (mimeType === 'application/pdf') {
      if (this.cloudinaryConfigured) {
        try {
          const result = await cloudinary.uploader.upload(
            `data:application/pdf;base64,${rawBase64}`,
            { folder: `jadexpress/${folder}`, resource_type: 'auto' },
          );
          return { url: result.secure_url, provider: 'cloudinary' };
        } catch (err: any) {
          console.warn('[UPLOADS] Cloudinary PDF upload failed:', err?.message);
        }
      }
      return { url: `data:application/pdf;base64,${rawBase64}`, provider: 'local-base64' };
    }

    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException(`Unsupported file type: ${mimeType}`);
    }

    // Compress with sharp: max 800px, JPEG quality 85
    let compressed: Buffer;
    try {
      compressed = await sharp(buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException('File is not a valid image');
    }

    if (this.cloudinaryConfigured) {
      try {
        const result = await cloudinary.uploader.upload(
          `data:image/jpeg;base64,${compressed.toString('base64')}`,
          {
            folder: `jadexpress/${folder}`,
            resource_type: 'image',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          },
        );
        return { url: result.secure_url, provider: 'cloudinary' };
      } catch (err: any) {
        console.warn('[UPLOADS] Cloudinary upload failed, falling back to compressed base64:', err?.message);
      }
    }

    // Fallback: return compressed base64 data URL (much smaller than original)
    return {
      url: `data:image/jpeg;base64,${compressed.toString('base64')}`,
      provider: 'local-base64',
    };
  }

  /**
   * Compress an image buffer with sharp (used by cleanup script).
   */
  async compressBuffer(buffer: Buffer, maxDim = 600): Promise<Buffer> {
    return sharp(buffer)
      .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  }
}
