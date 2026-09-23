import { createRemoteJWKSet, jwtVerify } from 'jose';
import { BillingError } from './ledger.mjs';
export const INKLURA_ISSUER = 'https://auth.1clic.pro';
export function createAuthenticator({ clientId, keySet = createRemoteJWKSet(new URL(INKLURA_ISSUER + '/.well-known/jwks.json')) }) {
  return async authorization => {
    if (!clientId) throw new BillingError('accounts_not_configured', 503);
    if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9_.-]+$/.test(authorization) || authorization.length > 16384) throw new BillingError('sign_in_required', 401);
    try {
      const { payload } = await jwtVerify(authorization.slice(7), keySet, {
        issuer: INKLURA_ISSUER, audience: clientId, algorithms: ['RS256', 'ES256'],
        requiredClaims: ['sub', 'iat', 'exp'], clockTolerance: 5,
      });
      if (!payload.sub || typeof payload.scope !== 'string' || !payload.scope.split(' ').includes('openid')) throw new Error('Expected an access token');
      return { issuer: payload.iss, subject: payload.sub };
    } catch { throw new BillingError('session_expired', 401); }
  };
}
