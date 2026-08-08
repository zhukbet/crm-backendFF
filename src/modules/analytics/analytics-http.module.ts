import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsModule } from './analytics.module';

@Module({
  imports: [AnalyticsModule, AuthModule],
  controllers: [AnalyticsController],
})
export class AnalyticsHttpModule {}
