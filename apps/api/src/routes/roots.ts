import type { FastifyInstance } from 'fastify';

export async function registerRootRoutes(app: FastifyInstance) {
  app.get('/api/roots', async () => ({ roots: app.managedRoots }));
}
