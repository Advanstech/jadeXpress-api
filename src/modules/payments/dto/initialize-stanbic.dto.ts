import { IsEmail, IsIn, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';

export class InitializeStanbicDto {
  @IsString()
  orderId!: string;

  @IsString()
  orderNumber!: string;

  @IsEmail()
  email!: string;

  @IsNumber()
  amount!: number; // Pesewas or GHS

  @IsIn(['momo', 'card'])
  channel!: 'momo' | 'card';

  @ValidateIf((o) => o.channel === 'momo')
  @IsIn(['mtn', 'telecel', 'at'])
  network?: 'mtn' | 'telecel' | 'at';

  @ValidateIf((o) => o.channel === 'momo')
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
