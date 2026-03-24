import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { canAttemptLogin, clearLoginAttempts, recordFailedLogin, verifyPassword } from '../lib/auth.js';

const loginBodySchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

function setSessionCookie(reply: FastifyReply) {
  reply.setCookie('cloud_driver_session', 'authenticated', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    maxAge: 60 * 60 * 24,
  });
}

function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie('cloud_driver_session', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    signed: true,
  });
}

function getRequestKey(request: FastifyRequest): string {
  return request.ip || request.headers['x-forwarded-for']?.toString() || 'unknown';
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get('/api/auth/me', async (request, reply) => {
    if (!app.isAuthenticated(request)) {
      reply.code(401);
      return { authenticated: false };
    }

    return { authenticated: true };
  });

  app.post('/api/auth/login', async (request, reply) => {
    const key = getRequestKey(request);

    if (!canAttemptLogin(key)) {
      reply.code(429);
      return {
        ok: false,
        message: 'Too many login attempts. Please wait before trying again.',
      };
    }

    const body = loginBodySchema.parse(request.body);
    const valid = verifyPassword(body.password, app.runtimeConfig.passwordHash);

    if (!valid) {
      recordFailedLogin(key);
      reply.code(401);
      return {
        ok: false,
        message: 'Invalid access password.',
      };
    }

    clearLoginAttempts(key);
    setSessionCookie(reply);

    return { ok: true };
  });

  app.post('/api/auth/logout', async (_request, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });
}
