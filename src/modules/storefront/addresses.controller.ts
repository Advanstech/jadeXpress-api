import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  CreateAddressSchema, CreateAddressDto,
  UpdateAddressSchema, UpdateAddressDto,
} from './dto/address.dto';

@ApiTags('storefront-addresses')
@ApiBearerAuth()
@Controller('storefront/addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List the current customer\'s addresses' })
  list(@CurrentUser() user: JwtPayload) {
    return this.addressesService.list(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new address' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateAddressSchema)) dto: CreateAddressDto,
  ) {
    return this.addressesService.create(user.sub, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an address' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAddressSchema)) dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an address' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.addressesService.remove(user.sub, id);
  }
}
