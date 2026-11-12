import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [endpoint, sdkDir, requestsFile] = process.argv.slice(2);
if (!endpoint || !sdkDir || !requestsFile) {
  console.error('Usage: node doris-readonly.mjs <HTTPS MCP URL> <MCP SDK package directory> <queries.json>');
  process.exit(2);
}

let gateway;
try {
  gateway = new URL(endpoint);
} catch {
  console.error('Specify a valid HTTPS MCP URL.');
  process.exit(2);
}
if (gateway.protocol !== 'https:' || gateway.username || gateway.password || gateway.search || gateway.hash) {
  console.error('Specify an HTTPS MCP URL without credentials, query parameters, or a fragment.');
  process.exit(2);
}

const sdk = (relativePath) => import(pathToFileURL(resolve(sdkDir, relativePath)));
const { Client } = await sdk('dist/esm/client/index.js');
const { StreamableHTTPClientTransport } = await sdk('dist/esm/client/streamableHttp.js');

const requests = JSON.parse(readFileSync(requestsFile, 'utf8'));
if (!Array.isArray(requests) || !requests.length) throw new Error('Expected a nonempty array of requests');
for (const {tool, arguments: args} of requests) {
  const action = args?.child_tool;
  if ((tool === 'doris_catalog' || tool === 'doris_query') && args && !Object.keys(args).length) continue;
  if (tool === 'doris_catalog' && action === 'get_table_context') continue;
  if (tool === 'doris_query' && (action === 'execute_query' || action === 'explain_query')) {
    const query = args.arguments;
    if (typeof query?.sql !== 'string' || !/^\s*(SELECT|WITH)\b/i.test(query.sql)) {
      throw new Error('Expected a bounded read-only SELECT query');
    }
    if (action === 'execute_query' && (!Number.isInteger(query.max_rows) || query.max_rows < 1 || query.max_rows > 1000 ||
        !Number.isInteger(query.timeout_ms) || query.timeout_ms < 1 || query.timeout_ms > 55000)) {
      throw new Error('Specify max_rows (1–1000) and timeout_ms (1–55000)');
    }
    continue;
  }
  throw new Error('Only Doris catalog schema and bounded read-only query tools are supported');
}

const state = randomBytes(24).toString('base64url');
const callback = Promise.withResolvers();
let redirectUrl, metadata, tokens, verifier, discovery;
const server = createServer((req, res) => {
  const target = new URL(req.url, redirectUrl);
  if (target.pathname !== '/callback' || target.searchParams.get('state') !== state) {
    res.writeHead(404).end(); return;
  }
  const code = target.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('未完成授权，可以关闭此页面。');
    callback.reject(new Error('OAuth authorization did not return a code'));
    return;
  }
  res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'}).end('授权已返回，可以关闭此页面。');
  callback.resolve(code);
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
redirectUrl = new URL('http://127.0.0.1:' + server.address().port + '/callback');
const oauth = {
  get redirectUrl() { return redirectUrl; },
  get clientMetadata() {
    return {client_name: '语音 PRD 只读查询', redirect_uris:[redirectUrl.toString()],
            grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'};
  },
  state:()=>state,
  clientInformation:()=>metadata,
  saveClientInformation:value=>{metadata=value},
  tokens:()=>tokens,
  saveTokens:value=>{tokens=value},
  codeVerifier:()=>verifier,
  saveCodeVerifier:value=>{verifier=value},
  discoveryState:()=>discovery,
  saveDiscoveryState:value=>{discovery=value},
  redirectToAuthorization: async url => {
    if (url.origin !== gateway.origin) throw new Error('Unexpected login origin');
    console.error('在浏览器中打开以下链接完成网关授权。\n' + url.href);
  },
};

const newClient = ()=>new Client({name:'voice-prd-read-only',version:'1.0'});
let client = newClient();
let transport = new StreamableHTTPClientTransport(gateway, {authProvider:oauth});
try {
  try {
    await client.connect(transport);
  } catch(e) {
    if (e?.constructor?.name !== 'UnauthorizedError' || tokens) throw e;
    const timer = setTimeout(()=>callback.reject(new Error('OAuth callback timed out')), 180000);
    try { await transport.finishAuth(await callback.promise); }
    finally { clearTimeout(timer); }
    transport = new StreamableHTTPClientTransport(gateway, {authProvider:oauth});
    client = newClient();
    await client.connect(transport);
  }
  server.close();
  for (const request of requests) {
    const result = await client.callTool({name:request.tool,arguments:request.arguments}, undefined, {timeout:70000});
    console.log(JSON.stringify({name:request.name,result:result.structuredContent ?? result}));
  }
} catch(e) {
  console.error(JSON.stringify({error:e.message}));
  process.exitCode=1;
} finally {
  server.close();
  await client.close().catch(()=>{});
}
