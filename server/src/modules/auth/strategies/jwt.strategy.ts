import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'contract-system-secret-key',
    });
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      username: payload.username,
      real_name: payload.real_name,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}
