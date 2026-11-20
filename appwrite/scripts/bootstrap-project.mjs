/**
 * Создаёт проект Appwrite, web-платформы и API-ключ для setup.mjs.
 *
 * Секреты только из окружения или из файла --credentials (не коммитить):
 *   console_email, console_password
 *   app_email, app_password   (нужны для --create-app-user)
 *
 * Пример:
 *   APPWRITE_ENDPOINT=https://host/v1 node scripts/bootstrap-project.mjs --credentials /path/credentials.txt
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const args = process.argv.slice(2);
const credentialsFlag = args.indexOf('--credentials');
const credentialsPath = credentialsFlag >= 0 ? args[credentialsFlag + 1] : '';
const createAppUser = args.includes('--create-app-user');

const fileEnv = {};
if (credentialsPath) {
  for (const line of readFileSync(credentialsPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    fileEnv[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
}

const endpoint = (process.env.APPWRITE_ENDPOINT || fileEnv.endpoint || '').replace(/\/$/, '');
const projectId = process.env.APPWRITE_PROJECT_ID || 'print-shop';
const consoleEmail = process.env.APPWRITE_CONSOLE_EMAIL || fileEnv.console_email;
const consolePassword = process.env.APPWRITE_CONSOLE_PASSWORD || fileEnv.console_password;
const appEmail = process.env.APPWRITE_APP_EMAIL || fileEnv.app_email;
const appPassword = process.env.APPWRITE_APP_PASSWORD || fileEnv.app_password;
const appName = process.env.APPWRITE_APP_NAME || 'Максим Ковалев';
const databaseId = process.env.APPWRITE_DATABASE_ID || 'print_shop';

if (!endpoint || !consoleEmail || !consolePassword) {
  console.error('Нужны APPWRITE_ENDPOINT и логин консоли (env или --credentials).');
  process.exit(1);
}

const endpointHost = new URL(endpoint).host;

const PLATFORMS = [
  ['Localhost', 'localhost'],
  ['Cloudflare tunnel', endpointHost],
  ['Firebase Hosting', 'sl-sandbox-b84b3.web.app'],
  ['Firebase Hosting legacy', 'sl-sandbox-b84b3.firebaseapp.com'],
];

const DATABASE_SCOPES = [
  'databases.read',
  'databases.write',
  'collections.read',
  'collections.write',
  'attributes.read',
  'attributes.write',
  'indexes.read',
  'indexes.write',
  'documents.read',
  'documents.write',
];

const cookieHeader = (response) => {
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
};

const request = async (path, { method = 'GET', body, cookie, project = 'console', key } = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': project,
  };
  if (cookie) headers.Cookie = cookie;
  if (key) headers['X-Appwrite-Key'] = key;
  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 300) };
    }
  }
  if (!response.ok) {
    const error = new Error(`${method} ${path} -> ${response.status} ${data.message || data.type || ''}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return { data, cookie: cookieHeader(response) || cookie || '' };
};

const login = async () => {
  const { data, cookie } = await request('/account/sessions/email', {
    method: 'POST',
    body: { email: consoleEmail, password: consolePassword },
  });
  if (!cookie) {
    throw new Error('Appwrite не вернул cookie сессии консоли.');
  }
  console.log(`Сессия консоли: ${data.$id}`);
  return cookie;
};

const ensureTeam = async (cookie) => {
  const { data } = await request('/teams', { cookie });
  const teams = data.teams || [];
  const existing = teams.find((team) => team.name === 'Print Shop');
  if (existing) {
    console.log(`Команда уже есть: ${existing.$id}`);
    return existing.$id;
  }
  const created = await request('/teams', {
    method: 'POST',
    cookie,
    body: { teamId: 'unique()', name: 'Print Shop' },
  });
  console.log(`Команда: ${created.data.$id}`);
  return created.data.$id;
};

const ensureProject = async (cookie, teamId) => {
  try {
    const { data } = await request(`/projects/${projectId}`, { cookie });
    console.log(`Проект уже есть: ${data.$id}`);
    return data.$id;
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  const { data } = await request('/projects', {
    method: 'POST',
    cookie,
    body: {
      projectId,
      name: 'Print Shop',
      teamId,
      region: 'default',
    },
  });
  console.log(`Проект: ${data.$id}`);
  return data.$id;
};

const ensurePlatforms = async (cookie) => {
  const { data } = await request(`/projects/${projectId}/platforms`, { cookie });
  const existing = new Set((data.platforms || []).map((platform) => platform.hostname));
  for (const [name, hostname] of PLATFORMS) {
    if (!hostname || existing.has(hostname)) {
      console.log(`Платформа ${hostname || name} уже есть`);
      continue;
    }
    await request(`/projects/${projectId}/platforms`, {
      method: 'POST',
      cookie,
      body: { type: 'web', name, hostname },
    });
    console.log(`Платформа: ${hostname}`);
  }
};

const ensureDatabaseKey = async (cookie) => {
  const { data } = await request(`/projects/${projectId}/keys`, { cookie });
  const keys = data.keys || [];
  const existing = keys.find((item) => item.name === 'schema-setup');
  if (existing) {
    console.log('Ключ schema-setup уже есть. Секрет повторно не выдаётся — используйте прежний appwrite/.env.');
    return '';
  }
  const created = await request(`/projects/${projectId}/keys`, {
    method: 'POST',
    cookie,
    body: { name: 'schema-setup', scopes: DATABASE_SCOPES },
  });
  console.log(`Ключ schema-setup: ${created.data.$id}`);
  return created.data.secret;
};

const writeEnv = (secret) => {
  if (!secret) return;
  const lines = [
    `APPWRITE_ENDPOINT=${endpoint}`,
    `APPWRITE_PROJECT_ID=${projectId}`,
    `APPWRITE_API_KEY=${secret}`,
    `APPWRITE_DATABASE_ID=${databaseId}`,
    'APPWRITE_DATABASE_NAME=Print Shop',
    '',
  ];
  writeFileSync(resolve(root, '.env'), lines.join('\n'), { mode: 0o600 });
  console.log('Записан appwrite/.env (в git не входит).');
};

const ensureUsersKey = async (cookie) => {
  const { data } = await request(`/projects/${projectId}/keys`, { cookie });
  const existing = (data.keys || []).find((item) => item.name === 'users-admin');
  if (existing) {
    throw new Error('Ключ users-admin уже есть, секрет повторно не выдаётся. Создайте пользователя в консоли.');
  }
  const created = await request(`/projects/${projectId}/keys`, {
    method: 'POST',
    cookie,
    body: { name: 'users-admin', scopes: ['users.read', 'users.write'] },
  });
  return created.data.secret;
};

const readSetupEnv = () => {
  const path = resolve(root, '.env');
  const values = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    values[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return values;
};

const ensureAppUser = async (cookie) => {
  if (!appEmail || !appPassword) {
    throw new Error('Для --create-app-user нужны app_email и app_password.');
  }
  const databaseKey = process.env.APPWRITE_API_KEY || readSetupEnv().APPWRITE_API_KEY;
  if (!databaseKey) {
    throw new Error('Нет APPWRITE_API_KEY. Сначала запустите bootstrap без --create-app-user и npm run setup.');
  }
  const usersKey = await ensureUsersKey(cookie);
  let userId = 'admin';
  try {
    const { data } = await request('/users', {
      method: 'POST',
      project: projectId,
      key: usersKey,
      body: {
        userId,
        email: appEmail,
        password: appPassword,
        name: appName,
      },
    });
    userId = data.$id;
    console.log(`Пользователь Auth: ${userId}`);
  } catch (error) {
    if (error.status !== 409) throw error;
    console.log('Пользователь Auth admin уже есть');
  }

  const { data: docs } = await request(
    `/databases/${databaseId}/collections/users/documents?queries[]=${encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'email', values: [appEmail] }))}`,
    { project: projectId, key: databaseKey },
  );
  if ((docs.total || 0) > 0) {
    console.log('Документ users уже есть');
    return;
  }
  await request(`/databases/${databaseId}/collections/users/documents`, {
    method: 'POST',
    project: projectId,
    key: databaseKey,
    body: {
      documentId: userId,
      data: {
        email: appEmail,
        displayName: appName,
        role: 'администратор',
        createdAt: Date.now(),
        authUserId: userId,
      },
    },
  });
  console.log('Документ users создан');
};

const main = async () => {
  const cookie = await login();
  if (createAppUser) {
    await ensureAppUser(cookie);
    return;
  }
  const teamId = await ensureTeam(cookie);
  await ensureProject(cookie, teamId);
  await ensurePlatforms(cookie);
  const secret = await ensureDatabaseKey(cookie);
  writeEnv(secret);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
