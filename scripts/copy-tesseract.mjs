// Copies the tesseract.js worker and WASM core into public/tesseract so the
// receipt scanner runs under the strict CSP (worker-src 'self') without
// jsDelivr. Runs on `postinstall`; output is git-ignored.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const out = join(process.cwd(), 'public', 'tesseract');
mkdirSync(out, { recursive: true });

const workerDist = join(dirname(require.resolve('tesseract.js/package.json')), 'dist');
cpSync(join(workerDist, 'worker.min.js'), join(out, 'worker.min.js'));

const coreDir = dirname(require.resolve('tesseract.js-core/package.json'));
for (const file of readdirSync(coreDir)) {
  if (/^tesseract-core.*\.(js|wasm)$/.test(file)) cpSync(join(coreDir, file), join(out, file));
}
console.log(`tesseract assets copied to ${out}`);
