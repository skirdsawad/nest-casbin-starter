import { Controller, Get, Post, Param, Body, Query, ParseIntPipe, HttpCode, UseGuards } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ApproveDto } from './dto/approve.dto';
import { BulkActionDto } from './dto/bulk-action.dto';
import { PoliciesGuard } from '../common/auth/policies.guard';
import { CheckPolicies } from '../common/auth/policies.decorator';

@Controller('requests')
@UseGuards(PoliciesGuard)
export class RequestsController {
  constructor(private readonly svc: RequestsService) {}

  @Get()
  @CheckPolicies('requests', 'view')
  list(@Query('departmentId', ParseIntPipe) departmentId: number) {
    return this.svc.list(departmentId);
  }

  @Get(':id')
  @CheckPolicies('requests', 'view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findById(id);
  }

  @Post()
  @CheckPolicies('requests', 'create')
  create(@Body() dto: CreateRequestDto) {
    return this.svc.create(dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @CheckPolicies('requests', 'edit')
  submit(@Param('id', ParseIntPipe) id: number) {
    return this.svc.submit(id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  // The guard will check the stage-specific permission inside the service for this one
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveDto) {
    return this.svc.approve(id, dto.decision);
  }

  @Post('bulk')
  @HttpCode(200)
  @CheckPolicies('requests', 'bulk_approve')
  bulk(@Body() body: BulkActionDto) {
    return this.svc.bulk(body.ids, body.action);
  }
}