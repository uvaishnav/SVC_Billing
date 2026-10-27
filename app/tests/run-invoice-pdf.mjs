import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('node_modules/.cache/invoice-tests', { recursive: true });
const outfile = 'node_modules/.cache/invoice-tests/invoicePdf.test.mjs';
await build({ entryPoints: ['tests/invoicePdf.test.tsx'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic' });
const result = spawnSync(process.execPath, [outfile], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
