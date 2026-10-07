import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/**
 * El core de Python (core/app/security.py) solo acepta peticiones con un token
 * HS256 cuyo claim "service" sea exactamente "vitalroute_gateway". Este servicio
 * firma ese token con la llave compartida del .env.
 *
 * Se guarda en caché y se renueva un minuto antes de expirar, para no firmar
 * uno nuevo en cada despacho.
 */
class TokenService {
  private cachedToken: string | null = null;
  private expiresAtMs = 0;

  private static readonly LIFETIME_SECONDS = 3600;
  private static readonly RENEW_MARGIN_MS = 60_000;

  getServiceToken(): string {
    const now = Date.now();
    if (this.cachedToken && now < this.expiresAtMs - TokenService.RENEW_MARGIN_MS) {
      return this.cachedToken;
    }

    this.cachedToken = jwt.sign(
      { service: env.jwtIssuerService },
      env.jwtSecret,
      {
        algorithm: env.jwtAlgorithm,
        expiresIn: TokenService.LIFETIME_SECONDS,
      }
    );
    this.expiresAtMs = now + TokenService.LIFETIME_SECONDS * 1000;

    return this.cachedToken;
  }
}

export const tokenService = new TokenService();
