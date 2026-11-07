import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { getWriteRoles, isAuthDisabled } from '../config/auth.config';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthenticatedUser } from './jwt.strategy';

function isWriteMethod(method: string | undefined): boolean {
  const normalized = (method ?? '').toUpperCase();
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalized);
}

@Injectable()
export class WriteAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (isAuthDisabled(this.configService)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      method?: string;
      user?: AuthenticatedUser;
    }>();

    if (!isWriteMethod(request.method)) {
      return true;
    }

    const requiredWriteRoles = getWriteRoles(this.configService);
    if (requiredWriteRoles.length === 0) {
      return true;
    }

    if (!request.user) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    if (!requiredWriteRoles.some((role) => request.user?.roles.includes(role))) {
      throw new ForbiddenException('Insufficient role for write access');
    }

    return true;
  }
}
