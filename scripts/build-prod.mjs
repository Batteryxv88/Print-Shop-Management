/**
 * Production webpack build with explicit PUBLIC_PATH (GitHub Pages vs Firebase Hosting).
 * Usage: node scripts/build-prod.mjs /
 */
import { spawnSync } from 'node:child_process';

const publicPath = process.argv[2];
if (!publicPath) {
    console.error('Usage: node scripts/build-prod.mjs <publicPath>');
    process.exit(1);
}

const normalized =
    publicPath.endsWith('/') || publicPath === '/'
        ? publicPath
        : `${publicPath}/`;

const result = spawnSync('npx', ['webpack', '--env', 'mode=production'], {
    stdio: 'inherit',
    env: { ...process.env, PUBLIC_PATH: normalized },
    shell: true,
});

process.exit(result.status ?? 1);
