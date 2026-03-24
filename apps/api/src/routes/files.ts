import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  FileServiceError,
  createFileReadStream,
  createFolder,
  deleteEntry,
  getDownloadInfo,
  getPreviewInfo,
  getRootById,
  listDirectory,
  moveEntry,
  readTextFile,
  renameEntry,
  saveUploadedFile,
  saveTextFile,
} from '../lib/files.js';

const relativePathSchema = z.string().optional().default('');

const listFilesQuerySchema = z.object({
  rootId: z.string().min(1),
  path: relativePathSchema,
});

const textContentQuerySchema = z.object({
  rootId: z.string().min(1),
  path: z.string().min(1),
});

const saveTextBodySchema = z.object({
  rootId: z.string().min(1),
  path: z.string().min(1),
  content: z.string(),
  etag: z.string().min(1),
});

const mkdirBodySchema = z.object({
  rootId: z.string().min(1),
  parentPath: relativePathSchema,
  name: z.string().min(1),
});

const renameBodySchema = z.object({
  rootId: z.string().min(1),
  path: z.string().min(1),
  newName: z.string().min(1),
});

const moveBodySchema = z.object({
  rootId: z.string().min(1),
  sourcePath: z.string().min(1),
  targetDirPath: relativePathSchema,
});

const deleteBodySchema = z.object({
  rootId: z.string().min(1),
  path: z.string().min(1),
});

function getMultipartFieldValue(field: unknown): string | undefined {
  if (Array.isArray(field)) {
    return getMultipartFieldValue(field[0]);
  }

  if (!field || typeof field !== 'object' || !('value' in field)) {
    return undefined;
  }

  const value = (field as { value?: unknown }).value;
  return typeof value === 'string' ? value : undefined;
}

function handleRouteError(error: unknown, reply: FastifyReply) {
  if (error instanceof FileServiceError) {
    reply.code(error.statusCode);
    return {
      message: error.message,
    };
  }

  reply.code(400);
  return {
    message: error instanceof Error ? error.message : 'File operation failed.',
  };
}

export async function registerFileRoutes(app: FastifyInstance) {
  app.get('/api/files/list', async (request, reply) => {
    try {
      const query = listFilesQuerySchema.parse(request.query);
      const root = getRootById(app.managedRoots, query.rootId);
      const items = await listDirectory(root, query.path);

      return {
        rootId: root.id,
        path: query.path,
        items,
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get('/api/files/content', async (request, reply) => {
    try {
      const query = textContentQuerySchema.parse(request.query);
      const root = getRootById(app.managedRoots, query.rootId);

      return await readTextFile(root, query.path);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.put('/api/files/content', async (request, reply) => {
    try {
      const body = saveTextBodySchema.parse(request.body);
      const root = getRootById(app.managedRoots, body.rootId);
      const saved = await saveTextFile(root, body.path, body.content, body.etag);

      return {
        ok: true,
        etag: saved.etag,
        modifiedAt: saved.modifiedAt,
        lineEnding: saved.lineEnding,
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post('/api/files/mkdir', async (request, reply) => {
    try {
      const body = mkdirBodySchema.parse(request.body);
      const root = getRootById(app.managedRoots, body.rootId);
      await createFolder(root, body.parentPath, body.name);

      return { ok: true };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.patch('/api/files/rename', async (request, reply) => {
    try {
      const body = renameBodySchema.parse(request.body);
      const root = getRootById(app.managedRoots, body.rootId);
      const path = await renameEntry(root, body.path, body.newName);

      return { ok: true, path };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post('/api/files/move', async (request, reply) => {
    try {
      const body = moveBodySchema.parse(request.body);
      const root = getRootById(app.managedRoots, body.rootId);
      const path = await moveEntry(root, body.sourcePath, body.targetDirPath);

      return { ok: true, path };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.delete('/api/files', async (request, reply) => {
    try {
      const body = deleteBodySchema.parse(request.body);
      const root = getRootById(app.managedRoots, body.rootId);
      await deleteEntry(root, body.path);

      return { ok: true };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post('/api/files/upload', async (request, reply) => {
    try {
      const file = await request.file();

      if (!file) {
        throw new FileServiceError(400, 'No file was provided');
      }

      const rootId = getMultipartFieldValue(file.fields.rootId);
      const targetPath = getMultipartFieldValue(file.fields.targetPath) ?? '';

      if (typeof rootId !== 'string' || !rootId) {
        throw new FileServiceError(400, 'rootId is required');
      }

      const root = getRootById(app.managedRoots, rootId);
      const path = await saveUploadedFile(root, targetPath, file.filename, file.file);

      return { ok: true, path };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get('/api/files/download', async (request, reply) => {
    try {
      const query = textContentQuerySchema.parse(request.query);
      const root = getRootById(app.managedRoots, query.rootId);
      const download = await getDownloadInfo(root, query.path);

      reply.header('content-disposition', `attachment; filename="${encodeURIComponent(download.fileName)}"`);
      reply.type(download.mimeType);
      return reply.send(createFileReadStream(download.filePath));
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get('/api/files/preview', async (request, reply) => {
    try {
      const query = textContentQuerySchema.parse(request.query);
      const root = getRootById(app.managedRoots, query.rootId);
      const preview = await getPreviewInfo(root, query.path);

      reply.header('content-disposition', `inline; filename="${encodeURIComponent(preview.fileName)}"`);
      reply.header('x-content-type-options', 'nosniff');
      reply.type(preview.mimeType);
      return reply.send(createFileReadStream(preview.filePath));
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
