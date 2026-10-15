/**
 * Создаёт базу print_shop, коллекции, атрибуты, индексы и начальные настройки.
 *
 * Требуется запущенный Appwrite и API key с правами на Databases.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    Client,
    Databases,
    ID,
    Permission,
    Role,
    Query,
} from 'node-appwrite';
import { collections, seedSettingsDocs } from '../schema/collections.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const loadEnv = () => {
    const path = resolve(root, '.env');
    if (!existsSync(path)) {
        console.error(
            'Нет appwrite/.env — скопируйте .env.example и заполните APPWRITE_*'
        );
        process.exit(1);
    }
    const text = readFileSync(path, 'utf8');
    /** @type {Record<string, string>} */
    const env = {};
    text.split('\n').forEach((line) => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return;
        const i = t.indexOf('=');
        if (i <= 0) return;
        env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    });
    return env;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const COLLECTION_PERMS = [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
];

const env = loadEnv();
const endpoint = env.APPWRITE_ENDPOINT;
const projectId = env.APPWRITE_PROJECT_ID;
const apiKey = env.APPWRITE_API_KEY;
const databaseId = env.APPWRITE_DATABASE_ID || 'print_shop';
const databaseName = env.APPWRITE_DATABASE_NAME || 'Print Shop';
const checkOnly = process.argv.includes('--check-only');

if (!endpoint || !projectId || !apiKey) {
    console.error(
        'Заполните APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY в appwrite/.env'
    );
    process.exit(1);
}

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

const databases = new Databases(client);

const listDatabases = async () => {
    const res = await databases.list();
    return res.databases || [];
};

const ensureDatabase = async () => {
    const all = await listDatabases();
    const found = all.find((d) => d.$id === databaseId);
    if (found) {
        console.log(`✓ База «${databaseId}» уже есть`);
        return;
    }
    if (checkOnly) {
        console.log(`✗ База «${databaseId}» не найдена (нужен setup без --check-only)`);
        return;
    }
    await databases.create(databaseId, databaseName);
    console.log(`+ Создана база «${databaseId}»`);
};

const listCollections = async () => {
    const res = await databases.listCollections(databaseId);
    return res.collections || [];
};

const waitAttributesReady = async (collectionId, expectedCount) => {
    for (let i = 0; i < 60; i++) {
        const res = await databases.listAttributes(databaseId, collectionId);
        const attrs = res.attributes || [];
        const ready = attrs.filter((a) => a.status === 'available').length;
        const failed = attrs.some((a) => a.status === 'failed');
        if (failed) {
            throw new Error(
                `Атрибут не создан в ${collectionId}: ${JSON.stringify(attrs.find((a) => a.status === 'failed'))}`
            );
        }
        if (ready >= expectedCount && attrs.length >= expectedCount) {
            return;
        }
        await sleep(500);
    }
    throw new Error(`Таймаут атрибутов для ${collectionId}`);
};

const createAttribute = async (collectionId, attr) => {
    const {
        key,
        type,
        required = false,
        size,
        min,
        max,
        array = false,
    } = attr;

    const common = { key, required, array };

    switch (type) {
        case 'string':
            await databases.createStringAttribute(
                databaseId,
                collectionId,
                key,
                size || 255,
                required,
                undefined,
                array
            );
            break;
        case 'integer':
            await databases.createIntegerAttribute(
                databaseId,
                collectionId,
                key,
                required,
                min ?? undefined,
                max ?? undefined,
                undefined,
                array
            );
            break;
        case 'double':
            await databases.createFloatAttribute(
                databaseId,
                collectionId,
                key,
                required,
                min ?? undefined,
                max ?? undefined,
                undefined,
                array
            );
            break;
        case 'boolean':
            await databases.createBooleanAttribute(
                databaseId,
                collectionId,
                key,
                required,
                undefined,
                array
            );
            break;
        case 'datetime':
            await databases.createDatetimeAttribute(
                databaseId,
                collectionId,
                key,
                required,
                undefined,
                array
            );
            break;
        default:
            throw new Error(`Неизвестный тип ${type} для ${key}`);
    }
    void common;
};

const ensureCollection = async (def, existingIds) => {
    if (existingIds.has(def.id)) {
        console.log(`  ✓ Коллекция ${def.id}`);
        return;
    }
    if (checkOnly) {
        console.log(`  ✗ Нет коллекции ${def.id}`);
        return;
    }

    await databases.createCollection(
        databaseId,
        def.id,
        def.name,
        COLLECTION_PERMS,
        true,
        true
    );
    console.log(`  + Коллекция ${def.id}`);

    for (const attr of def.attributes) {
        try {
            await createAttribute(def.id, attr);
        } catch (err) {
            const msg = String(err?.message || err);
            if (/already exists|duplicate/i.test(msg)) {
                continue;
            }
            throw err;
        }
        await sleep(300);
    }

    await waitAttributesReady(def.id, def.attributes.length);

    for (const idx of def.indexes || []) {
        try {
            await databases.createIndex(
                databaseId,
                def.id,
                idx.key,
                idx.type || 'key',
                idx.attributes,
                idx.orders || idx.attributes.map(() => 'ASC')
            );
        } catch (err) {
            const msg = String(err?.message || err);
            if (/already exists|duplicate/i.test(msg)) {
                continue;
            }
            throw err;
        }
        await sleep(400);
    }
};

const seedAppSettings = async () => {
    if (checkOnly) return;

    for (const doc of seedSettingsDocs) {
        const key = doc.settingsKey;
        const existing = await databases.listDocuments(
            databaseId,
            'AppSettings',
            [Query.equal('settingsKey', key), Query.limit(1)]
        );
        if (existing.total > 0) {
            console.log(`  ✓ AppSettings «${key}» уже есть`);
            continue;
        }
        const payload = { ...doc };
        if (payload.counterReadingDay == null) {
            delete payload.counterReadingDay;
        }
        await databases.createDocument(
            databaseId,
            'AppSettings',
            ID.unique(),
            payload,
            COLLECTION_PERMS
        );
        console.log(`  + AppSettings «${key}»`);
    }
};

const writeGeneratedEnv = () => {
    const lines = [
        `# Сгенерировано appwrite/scripts/setup.mjs`,
        `APPWRITE_ENDPOINT=${endpoint}`,
        `APPWRITE_PROJECT_ID=${projectId}`,
        `APPWRITE_DATABASE_ID=${databaseId}`,
        `DATA_BACKEND=appwrite`,
        '',
    ];
    writeFileSync(resolve(root, 'generated.env'), lines.join('\n'), 'utf8');
    console.log('\nФайл appwrite/generated.env — скопируйте значения в корневой .env когда будете переключать фронт.');
};

const main = async () => {
    console.log('Appwrite setup — Print Shop Management\n');
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Project:  ${projectId}`);
    console.log(`Database: ${databaseId}\n`);

    await ensureDatabase();

    const existing = await listCollections();
    const existingIds = new Set(existing.map((c) => c.$id));

    console.log('Коллекции:');
    for (const def of collections) {
        await ensureCollection(def, existingIds);
    }

    if (!existingIds.has('AppSettings') && !checkOnly) {
        console.log('Начальные настройки:');
        await seedAppSettings();
    } else if (existingIds.has('AppSettings')) {
        await seedAppSettings();
    }

    if (!checkOnly) {
        writeGeneratedEnv();
    }

    console.log('\nГотово.');
    if (getDataBackendHint()) {
        console.log(getDataBackendHint());
    }
};

const getDataBackendHint = () =>
    'Firebase по-прежнему активен в приложении (DATA_BACKEND=firebase). Appwrite — только подготовленная схема.';

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
