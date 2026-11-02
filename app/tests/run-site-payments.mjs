import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
await mkdir('node_modules/.cache/payment-tests', { recursive: true })
const outfile = 'node_modules/.cache/payment-tests/sitePayments.mjs'
await build({
  entryPoints: ['tests/sitePayments.test.ts'], outfile, bundle: true, platform: 'node', format: 'esm',
  plugins: [{ name: 'mock-payment-db', setup(build) {
    build.onResolve({ filter: /supabaseClient$/ }, () => ({ path: 'mock-db', namespace: 'mock' }))
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const supabase = { from: (...args) => globalThis.paymentTestDb.from(...args) }' }))
  } }],
})
const result = spawnSync(process.execPath, [outfile], { stdio: 'inherit' })
process.exit(result.status ?? 1)
