import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Agent } from '@prisma/client';

export const CurrentAgent = createParamDecorator((_data: unknown, ctx: ExecutionContext): Agent => {
  const request = ctx.switchToHttp().getRequest();
  return request.agent;
});
