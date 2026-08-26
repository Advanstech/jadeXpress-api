import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorefrontAuthController } from './storefront-auth.controller';
import { StorefrontAuthService } from './storefront-auth.service';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule],
  controllers: [StorefrontAuthController, AddressesController, OrdersController],
  providers: [StorefrontAuthService, AddressesService, OrdersService],
  exports: [OrdersService],
})
export class StorefrontModule {}
