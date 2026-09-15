import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UpdateOrganisationSchema, UpdateOrganisationDto } from './dto/settings.dto';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('organisation')
  @ApiOperation({ summary: 'Get organisation config (tax rates, branding)' })
  getOrganisation() {
    return this.settingsService.getOrganisation();
  }

  @Put('organisation')
  @Roles('owner', 'root', 'super_admin')
  @ApiOperation({ summary: 'Update organisation config — applies to all terminals' })
  updateOrganisation(
    @Body(new ZodValidationPipe(UpdateOrganisationSchema)) dto: UpdateOrganisationDto,
  ) {
    return this.settingsService.updateOrganisation(dto);
  }
}
