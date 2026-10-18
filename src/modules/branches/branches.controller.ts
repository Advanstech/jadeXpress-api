import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BranchesService } from './branches.service';
import {
  createBranchSchema,
  updateBranchSchema,
  CreateBranchDto,
  UpdateBranchDto,
} from './dto/branches.dto';

@ApiTags('Branch Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @ApiOperation({ summary: 'List all branches with live aggregated inventory & financial stats' })
  async listBranches(@Query() query: { status?: string; search?: string }) {
    return this.branchesService.listBranches(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch details, inventory performance, and staff roster' })
  async getBranchById(@Param('id') id: string) {
    return this.branchesService.getBranchById(id);
  }

  @Get(':id/inventory')
  @ApiOperation({ summary: 'Get live inventory for a specific branch' })
  async getBranchInventory(
    @Param('id') id: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.branchesService.getBranchInventory(
      id,
      search,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post()
  @Roles('owner', 'root', 'super_admin', 'manager')
  @ApiOperation({ summary: 'Create a new branch / store location' })
  async createBranch(
    @Body(new ZodValidationPipe(createBranchSchema)) dto: CreateBranchDto,
  ) {
    return this.branchesService.createBranch(dto);
  }

  @Put(':id')
  @Roles('owner', 'root', 'super_admin', 'manager')
  @ApiOperation({ summary: 'Update branch information, operational status, or terminal config' })
  async updateBranch(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBranchSchema)) dto: UpdateBranchDto,
  ) {
    return this.branchesService.updateBranch(id, dto);
  }
}
