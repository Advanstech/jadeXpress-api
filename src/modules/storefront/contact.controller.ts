import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ContactService } from './contact.service';
import {
  CreateContactMessageSchema,
  CreateContactMessageDto,
  UpdateContactMessageSchema,
  UpdateContactMessageDto,
} from './dto/contact.dto';

@ApiTags('Storefront Contact & Inbox')
@Controller('storefront')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @Post('contact')
  @ApiOperation({ summary: 'Submit a contact / inquiry message from the storefront' })
  submitContact(
    @Body(new ZodValidationPipe(CreateContactMessageSchema)) dto: CreateContactMessageDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.contactService.createContactMessage(dto, user?.sub);
  }

  @Get('admin/inbox')
  @Roles('owner', 'manager', 'supervisor')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all contact inquiry messages (Admin Inbox)' })
  getInboxMessages(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contactService.getMessages({
      status,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('admin/inbox/:id')
  @Roles('owner', 'manager', 'supervisor')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single inbox message detail' })
  getInboxMessage(@Param('id') id: string) {
    return this.contactService.getMessageById(id);
  }

  @Patch('admin/inbox/:id')
  @Roles('owner', 'manager', 'supervisor')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update message status or resolution note / reply' })
  updateInboxMessage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateContactMessageSchema)) dto: UpdateContactMessageDto,
  ) {
    return this.contactService.updateMessage(id, dto);
  }

  @Delete('admin/inbox/:id')
  @Roles('owner', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an inbox message' })
  deleteInboxMessage(@Param('id') id: string) {
    return this.contactService.deleteMessage(id);
  }
}
