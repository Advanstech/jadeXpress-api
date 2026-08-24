import { IsNumber, IsOptional, IsString } from 'class-validator';

export class RequestMomoDto {
  @IsString()
  phone!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  currency: string = 'GHS';

  @IsOptional()
  @IsString()
  orderId?: string;
}
