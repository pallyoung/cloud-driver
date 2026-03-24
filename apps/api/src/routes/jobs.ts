import type { FastifyInstance } from 'fastify';

export async function registerJobRoutes(app: FastifyInstance) {
  app.get('/api/jobs', async () => ({
    exports: app.exportJobService.listJobs(),
    backups: app.backupJobService.listJobs(),
  }));
}
