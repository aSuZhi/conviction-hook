import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.PORT || 5175);
const host = process.env.HOST || '127.0.0.1';

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
]);

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', `http://${host}:${port}`).pathname);
  const requestedPath = path.normalize(path.join(root, pathname));
  const filePath = requestedPath.startsWith(root) && (await isFile(requestedPath)) ? requestedPath : path.join(root, 'index.html');
  const ext = path.extname(filePath);

  try {
    response.writeHead(200, {
      'content-type': contentTypes.get(ext) || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(await readFile(filePath));
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : String(error));
  }
}).listen(port, host, () => {
  console.log(`Conviction preview listening at http://${host}:${port}/`);
});

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}
