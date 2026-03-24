import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/api/health/live', async () => ({ ok: true }));
  app.get('/api/health/ready', async () => ({ ok: true }));
}
