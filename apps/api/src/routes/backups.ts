import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { FileServiceError } from '../lib/files.js';

const createBackupBodySchema = z.object({
  rootId: z.string().min(1),
  path: z.string().min(1),
  targetPath: z.string().min(1),
  conflictPolicy: z.enum(['skip', 'overwrite', 'rename']),
});

const jobIdParamsSchema = z.object({
  id: z.string().min(1),
});

function handleRouteError(error: unknown, reply: FastifyReply) {
  if (error instanceof FileServiceError) {
    reply.code(error.statusCode);
    return {
      message: error.message,
    };
  }

  reply.code(400);
  return {
    message: error instanceof Error ? error.message : 'Backup operation failed.',
  };
}

export async function registerBackupRoutes(app: FastifyInstance) {
  app.post('/api/backups', async (request, reply) => {
    try {
      const body = createBackupBodySchema.parse(request.body);
      return await app.backupJobService.createJob({
        rootId: body.rootId,
        sourcePath: body.path,
        targetPath: body.targetPath,
        conflictPolicy: body.conflictPolicy,
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get('/api/backups/jobs', async () => ({
    items: app.backupJobService.listJobs(),
  }));

  app.post('/api/backups/jobs/:id/retry', async (request, reply) => {
    try {
      const params = jobIdParamsSchema.parse(request.params);
      return await app.backupJobService.retryJob(params.id);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
