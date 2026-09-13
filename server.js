import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeSearchResponse } from './src/zhihu.js';

const execFileAsync = promisify(execFile);
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const cliName = process.platform === 'win32' ? 'zhihu-cli.exe' : 'zhihu-cli';

function resolveCli() {
  if (process.env.ZHIHU_CLI_PATH) return process.env.ZHIHU_CLI_PATH;
  const home = process.env.ZHIHU_CLI_HOME;
  if (home) {
    const candidate = path.join(home, 'current', cliName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return cliName;
}

const cli = resolveCli();

async function searchZhihu(query) {
  const { stdout } = await execFileAsync(cli, ['search', 'zhihu', '--query', query, '--count', '8'], { env: process.env, timeout: 30000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  return normalizeSearchResponse(JSON.parse(stdout));
}

function sendJson(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
function safeFile(urlPath) { const clean = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath).replace(/^[/\\]+/, ''); const target = path.resolve(root, clean); const relative = path.relative(root, target); return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? target : null; }

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/search') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 10000) req.destroy(); });
    req.on('end', async () => {
      try {
        const query = String(JSON.parse(body).query || '').trim();
        if (query.length < 2 || query.length > 120) return sendJson(res, 400, { error: 'query must be 2-120 characters' });
        try {
          const items = await searchZhihu(query);
          return sendJson(res, 200, { items, source: 'zhihu-search', fallback: false });
        } catch (error) {
          console.warn(`[zhihu] 搜索失败，已降级为演示资料：${error.code || error.message}`);
          return sendJson(res, 200, { items: [], source: 'offline-fixture', fallback: true, message: '知乎内容暂时不可用，已切换到演示资料' });
        }
      } catch { return sendJson(res, 400, { error: 'invalid JSON body' }); }
    });
    return;
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });
  const file = safeFile(req.url);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.json': 'application/json' };
  res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, () => {
  const resolved = path.isAbsolute(cli) && fs.existsSync(cli);
  console.log(`答主考官运行于 http://localhost:${port}`);
  console.log(resolved ? `[zhihu] CLI: ${cli}` : `[zhihu] 未找到可用 CLI（当前解析为 "${cli}"），检索将降级为演示资料。可设置 ZHIHU_CLI_PATH 指定绝对路径。`);
});
