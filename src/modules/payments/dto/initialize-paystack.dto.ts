import { IsEmail, IsNumber, IsOptional, IsString, IsObject } from 'class-validator';

export class InitializePaystackDto {
  @IsEmail()
  email!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  currency: string = 'GHS';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
