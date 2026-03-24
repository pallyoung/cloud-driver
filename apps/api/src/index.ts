import { pathToFileURL } from 'node:url';
import { startServer } from './server.js';

const entryPoint = process.argv[1];
const isMainModule = entryPoint ? import.meta.url === pathToFileURL(entryPoint).href : false;

if (isMainModule) {
  try {
    await startServer();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
