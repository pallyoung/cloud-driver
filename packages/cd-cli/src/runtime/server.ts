import { startServer } from '../../../../apps/api/src/server.ts';

void (async () => {
  await startServer();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
