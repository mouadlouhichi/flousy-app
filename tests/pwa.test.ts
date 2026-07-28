import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');

const manifest = JSON.parse(readFileSync(path.join(publicDir, 'manifest.json'), 'utf8'));

/** Minimal PNG header reader so we can assert real pixel dimensions. */
function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  assert.equal(buf.readUInt32BE(0), 0x89504e47, `${file} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('PWA manifest', () => {
  it('declares the fields browsers require for installability', () => {
    for (const field of ['name', 'short_name', 'start_url', 'display', 'icons']) {
      assert.ok(manifest[field], `manifest is missing "${field}"`);
    }
    assert.ok(
      ['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display),
      'display must be app-like for the install prompt to fire'
    );
  });

  it('ships 192px and 512px "any" icons that actually exist on disk', () => {
    for (const size of ['192x192', '512x512']) {
      const icon = manifest.icons.find(
        (i: { sizes: string; purpose?: string }) =>
          i.sizes === size && (i.purpose ?? 'any').split(' ').includes('any')
      );
      assert.ok(icon, `no "any" icon declared at ${size}`);

      const file = path.join(publicDir, icon.src);
      assert.ok(existsSync(file), `${icon.src} is declared but missing from /public`);

      const [w, h] = size.split('x').map(Number);
      assert.deepEqual(pngSize(file), { width: w, height: h }, `${icon.src} has wrong dimensions`);
    }
  });

  it('keeps maskable icons separate from "any" icons', () => {
    const maskable = manifest.icons.filter((i: { purpose?: string }) =>
      (i.purpose ?? '').split(' ').includes('maskable')
    );
    assert.ok(maskable.length >= 1, 'expected at least one maskable icon');

    // Declaring "any maskable" on one file makes Android zoom/crop the icon.
    for (const icon of manifest.icons) {
      const purposes = (icon.purpose ?? 'any').split(' ');
      assert.ok(
        !(purposes.includes('any') && purposes.includes('maskable')),
        `${icon.src} combines "any" and "maskable"; split them into separate entries`
      );
      assert.ok(existsSync(path.join(publicDir, icon.src)), `${icon.src} is missing`);
    }
  });

  it('scopes start_url so the installed app opens inside the app shell', () => {
    assert.ok(String(manifest.start_url).startsWith('/'));
    assert.ok(String(manifest.scope ?? '/').startsWith('/'));
  });
});

describe('service worker', () => {
  const sw = readFileSync(path.join(publicDir, 'sw.js'), 'utf8');

  it('has a fetch handler (required before Chrome offers an install prompt)', () => {
    assert.match(sw, /addEventListener\(\s*['"]fetch['"]/);
  });

  it('only precaches files that exist, so install cannot reject', () => {
    // `[^\]]` already spans newlines, so no dotAll flag is needed (target is ES2017).
    const list = sw.match(/ASSETS_TO_CACHE\s*=\s*\[([^\]]*)\]/);
    assert.ok(list, 'could not find ASSETS_TO_CACHE');

    const urls = [...list[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    assert.ok(urls.length > 0, 'expected at least one precached asset');

    for (const url of urls) {
      // Root navigations are served by Next, not a static file.
      if (url === '/') continue;
      assert.ok(
        existsSync(path.join(publicDir, url)),
        `sw.js precaches "${url}" but no such file exists — cache.addAll() would reject and abort install`
      );
    }
  });

  it('never caches auth or database traffic', () => {
    for (const host of ['firestore.googleapis.com', 'identitytoolkit.googleapis.com', '/api']) {
      assert.ok(sw.includes(host), `sw.js should bypass ${host}`);
    }
  });

  it('ignores non-GET requests', () => {
    assert.match(sw, /request\.method\s*!==\s*['"]GET['"]/);
  });
});

describe('install prompt wiring', () => {
  const layout = readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf8');

  it('registers the service worker somewhere in the tree', () => {
    assert.ok(layout.includes('ServiceWorkerRegistrar'));
    const registrar = readFileSync(
      path.join(root, 'src/components/pwa/service-worker-registrar.tsx'),
      'utf8'
    );
    assert.match(registrar, /navigator\.serviceWorker\.register\(\s*['"]\/sw\.js['"]/);
  });

  it('captures beforeinstallprompt before React hydrates', () => {
    assert.ok(layout.includes('InstallPromptCapture'));
    const capture = readFileSync(
      path.join(root, 'src/components/pwa/install-prompt-capture.tsx'),
      'utf8'
    );
    assert.match(capture, /beforeinstallprompt/);
    assert.match(capture, /preventDefault\(\)/);
    assert.match(capture, /__flousyInstallPrompt/);
  });

  it('renders install UI and the iOS-specific meta tag', () => {
    assert.ok(layout.includes('InstallBanner'));
    assert.ok(layout.includes('apple-mobile-web-app-capable'));
  });
});

describe('beforeinstallprompt capture behaviour', () => {
  /** Runs the inline capture script against a fake window. */
  function runCapture() {
    const listeners: Record<string, Array<(e: unknown) => void>> = {};
    const win = {
      __flousyInstallPrompt: null as unknown,
      addEventListener(type: string, fn: (e: unknown) => void) {
        (listeners[type] ||= []).push(fn);
      },
      dispatchEvent(event: { type: string }) {
        (listeners[event.type] || []).forEach((fn) => fn(event));
      },
    };

    const source = readFileSync(
      path.join(root, 'src/components/pwa/install-prompt-capture.tsx'),
      'utf8'
    );
    const script = source.match(/const CAPTURE_SCRIPT = `([\s\S]*?)`;/)?.[1];
    assert.ok(script, 'could not extract capture script');

    // eslint-disable-next-line no-new-func
    new Function('window', 'Event', script)(win, class {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    });

    return { win, listeners };
  }

  it('prevents the default mini-infobar and stores the event', () => {
    const { win, listeners } = runCapture();

    let prevented = false;
    const fakeEvent = {
      type: 'beforeinstallprompt',
      preventDefault: () => {
        prevented = true;
      },
    };

    listeners['beforeinstallprompt'].forEach((fn) => fn(fakeEvent));

    assert.equal(prevented, true, 'must call preventDefault() to keep the event usable');
    assert.equal(win.__flousyInstallPrompt, fakeEvent, 'event must be stashed for React');
  });

  it('clears the stored prompt once the app is installed', () => {
    const { win, listeners } = runCapture();

    listeners['beforeinstallprompt'].forEach((fn) =>
      fn({ type: 'beforeinstallprompt', preventDefault() {} })
    );
    assert.ok(win.__flousyInstallPrompt);

    listeners['appinstalled'].forEach((fn) => fn({ type: 'appinstalled' }));
    assert.equal(win.__flousyInstallPrompt, null);
  });
});
