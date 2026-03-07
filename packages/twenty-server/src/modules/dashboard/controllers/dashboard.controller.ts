import { Controller, Param, Post, UseFilters, UseGuards } from '@nestjs/common';

import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { FirebaseAuthGuard } from 'src/engine/core-modules/auth/guards/firebase-auth.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { DuplicatedDashboardDTO } from 'src/modules/dashboard/dtos/duplicated-dashboard.dto';
import { DashboardRestApiExceptionFilter } from 'src/modules/dashboard/filters/dashboard-rest-api-exception.filter';
import { DashboardDuplicationService } from 'src/modules/dashboard/services/dashboard-duplication.service';

@Controller('rest/dashboards')
@UseGuards(FirebaseAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
@UseFilters(DashboardRestApiExceptionFilter)
export class DashboardController {
  constructor(
    private readonly dashboardDuplicationService: DashboardDuplicationService,
  ) {}

  @Post(':id/duplicate')
  async duplicate(@Param('id') id: string): Promise<DuplicatedDashboardDTO> {
    const authContext = getWorkspaceAuthContext();

    return this.dashboardDuplicationService.duplicateDashboard(id, authContext);
  }
}
