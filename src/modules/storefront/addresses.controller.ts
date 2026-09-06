import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CustomerAuthGuard } from './guards/customer-token.guard';
import {
  CreateAddressSchema, CreateAddressDto,
  UpdateAddressSchema, UpdateAddressDto,
} from './dto/address.dto';

@ApiTags('storefront-addresses')
@ApiBearerAuth()
@Controller('storefront/addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List the current customer\'s addresses' })
  list(@CurrentUser() user: JwtPayload) {
    return this.addressesService.list(user.sub);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Add a new address' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateAddressSchema)) dto: CreateAddressDto,
  ) {
    return this.addressesService.create(user.sub, dto);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: 'Update an address' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAddressSchema)) dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(user.sub, id, dto);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an address' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.addressesService.remove(user.sub, id);
  }
}
