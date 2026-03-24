import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createFileReadStream } from '../lib/files.js';
import { FileServiceError } from '../lib/files.js';

const createExportBodySchema = z.object({
  rootId: z.string().min(1),
  path: z.string().optional().default(''),
});

function handleRouteError(error: unknown, reply: import('fastify').FastifyReply) {
  if (error instanceof FileServiceError) {
    reply.code(error.statusCode);
    return {
      message: error.message,
    };
  }

  reply.code(400);
  return {
    message: error instanceof Error ? error.message : 'Export operation failed.',
  };
}

export async function registerExportRoutes(app: FastifyInstance) {
  app.post('/api/exports', async (request, reply) => {
    try {
      const body = createExportBodySchema.parse(request.body);
      const job = await app.exportJobService.createDirectoryExport(body.rootId, body.path);
      return job;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get('/api/exports/:id/download', async (request, reply) => {
    try {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const download = app.exportJobService.getDownload(params.id);
      let cleaned = false;

      const cleanup = async () => {
        if (cleaned) {
          return;
        }
        cleaned = true;
        await app.exportJobService.markDownloadedAndCleanup(params.id);
      };

      reply.raw.once('finish', () => {
        void cleanup();
      });

      reply.raw.once('close', () => {
        void cleanup();
      });

      reply.header('content-disposition', `attachment; filename="${encodeURIComponent(download.fileName)}"`);
      reply.type(download.mimeType);
      return reply.send(createFileReadStream(download.filePath));
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
