import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorefrontAuthController } from './storefront-auth.controller';
import { StorefrontAuthService } from './storefront-auth.service';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({
  imports: [AuthModule],
  controllers: [
    StorefrontAuthController,
    AddressesController,
    OrdersController,
    ContactController,
  ],
  providers: [
    StorefrontAuthService,
    AddressesService,
    OrdersService,
    ContactService,
  ],
  exports: [OrdersService, ContactService],
})
export class StorefrontModule {}
