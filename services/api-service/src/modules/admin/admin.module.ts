import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { JwtAdminGuard } from '../../common/guards/jwt-admin.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    JwtModule.register({
      // Secret is read at runtime from process.env.JWT_SECRET inside JwtAdminGuard.
      // We still need to register the module for JwtService injection.
      secret: process.env.JWT_SECRET ?? 'changeme',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService, JwtAdminGuard],
})
export class AdminModule {}
