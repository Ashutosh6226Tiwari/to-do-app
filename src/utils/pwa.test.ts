import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('1. manifest.webmanifest satisfies all PWA installability requirements', () => {
  const manifestPath = path.resolve(process.cwd(), 'public/manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest must exist in public folder');

  const content = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(content);

  assert.equal(manifest.name, 'Lumo', 'name must be Lumo');
  assert.equal(manifest.short_name, 'Lumo', 'short_name must be Lumo');
  assert.equal(manifest.start_url, '/', 'start_url must be /');
  assert.equal(manifest.scope, '/', 'scope must be /');
  assert.equal(manifest.display, 'standalone', 'display must be standalone');
  assert.equal(manifest.orientation, 'portrait-primary', 'orientation must be portrait-primary');
  assert.equal(manifest.theme_color, '#0284C7', 'theme_color must match Calm theme (#0284C7)');
  assert.equal(manifest.background_color, '#F0F9FF', 'background_color must match Calm theme (#F0F9FF)');
  assert.deepEqual(manifest.categories, ['education', 'productivity'], 'categories must include education and productivity');

  // Verify icons
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'Must provide icons array with at least 3 entries');
  const has192 = manifest.icons.some((icon: { sizes: string; src: string }) => icon.sizes === '192x192' && icon.src.includes('192'));
  const has512 = manifest.icons.some((icon: { sizes: string; src: string; purpose?: string }) => icon.sizes === '512x512' && (!icon.purpose || icon.purpose.includes('any')));
  const hasMaskable512 = manifest.icons.some((icon: { sizes: string; purpose?: string }) => icon.sizes === '512x512' && icon.purpose?.includes('maskable'));

  assert.ok(has192, 'Manifest must have a 192x192 icon');
  assert.ok(has512, 'Manifest must have a standard 512x512 icon');
  assert.ok(hasMaskable512, 'Manifest must have a maskable 512x512 icon');

  // Verify icon files physically exist on disk
  for (const icon of manifest.icons) {
    const iconPath = path.resolve(process.cwd(), 'public', icon.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(iconPath), `Icon file ${icon.src} must exist on disk at ${iconPath}`);
    const stat = fs.statSync(iconPath);
    assert.ok(stat.size > 0, `Icon file ${icon.src} must not be empty`);
  }

  // Verify apple-touch-icon exists
  const appleTouchPath = path.resolve(process.cwd(), 'public/icons/apple-touch-icon.png');
  assert.ok(fs.existsSync(appleTouchPath), 'apple-touch-icon.png must exist');
  assert.ok(fs.statSync(appleTouchPath).size > 0, 'apple-touch-icon.png must not be empty');

  // Verify screenshots
  assert.ok(Array.isArray(manifest.screenshots) && manifest.screenshots.length >= 2, 'Must provide narrow and wide screenshots');
  for (const shot of manifest.screenshots) {
    const shotPath = path.resolve(process.cwd(), 'public', shot.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(shotPath), `Screenshot file ${shot.src} must exist on disk`);
  }
});

test('2. public/.well-known/assetlinks.json exists and contains empty array', () => {
  const assetlinksPath = path.resolve(process.cwd(), 'public/.well-known/assetlinks.json');
  assert.ok(fs.existsSync(assetlinksPath), '.well-known/assetlinks.json must exist');
  const content = fs.readFileSync(assetlinksPath, 'utf-8');
  const parsed = JSON.parse(content);
  assert.deepEqual(parsed, [], 'assetlinks.json should contain an empty array []');
});

test('3. public/offline.html provides offline fallback page with Lumo branding', () => {
  const offlinePath = path.resolve(process.cwd(), 'public/offline.html');
  assert.ok(fs.existsSync(offlinePath), 'public/offline.html must exist');
  const html = fs.readFileSync(offlinePath, 'utf-8');
  assert.ok(html.includes('Lumo'), 'offline.html must mention Lumo');
  assert.ok(html.includes('Offline Mode') || html.includes('You are offline'), 'offline.html must indicate offline status');
  assert.ok(html.includes('Retry Connection') || html.includes('window.location.reload()'), 'offline.html must include retry action');
});

test('4. public/sw.js excludes /api/*, Firebase Auth, and Firestore requests from caching', () => {
  const swPath = path.resolve(process.cwd(), 'public/sw.js');
  assert.ok(fs.existsSync(swPath), 'public/sw.js must exist');
  const swCode = fs.readFileSync(swPath, 'utf-8');

  // Must not cache /api/
  assert.ok(swCode.includes('/api/'), 'Service worker must handle /api/ path checks');
  assert.ok(swCode.includes('firestore.googleapis.com'), 'Service worker must explicitly exclude firestore.googleapis.com');
  assert.ok(swCode.includes('identitytoolkit.googleapis.com'), 'Service worker must explicitly exclude identitytoolkit.googleapis.com');
  assert.ok(swCode.includes('securetoken.googleapis.com'), 'Service worker must explicitly exclude securetoken.googleapis.com');

  // Must have install, activate, fetch, message, and notificationclick event listeners
  assert.ok(swCode.includes("addEventListener('install'"), 'SW must handle install event');
  assert.ok(swCode.includes("addEventListener('activate'"), 'SW must handle activate event');
  assert.ok(swCode.includes("addEventListener('fetch'"), 'SW must handle fetch event');
  assert.ok(swCode.includes("addEventListener('message'"), 'SW must handle message event');
  assert.ok(swCode.includes("addEventListener('notificationclick'"), 'SW must handle notificationclick event');
  assert.ok(swCode.includes('SKIP_WAITING'), 'SW must handle SKIP_WAITING message');
  assert.ok(swCode.includes('SHOW_TIMER_NOTIFICATION'), 'SW must handle SHOW_TIMER_NOTIFICATION message');
});

test('5. index.html contains manifest link, viewport, theme-color, and iOS meta tags', () => {
  const indexPath = path.resolve(process.cwd(), 'index.html');
  assert.ok(fs.existsSync(indexPath), 'index.html must exist');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  assert.ok(indexHtml.includes('rel="manifest"') && indexHtml.includes('manifest.webmanifest'), 'index.html must link to manifest.webmanifest');
  assert.ok(indexHtml.includes('name="theme-color"'), 'index.html must have theme-color meta tag');
  assert.ok(indexHtml.includes('name="apple-mobile-web-app-capable"'), 'index.html must have apple-mobile-web-app-capable meta tag');
  assert.ok(indexHtml.includes('name="mobile-web-app-capable"'), 'index.html must have mobile-web-app-capable meta tag');
  assert.ok(indexHtml.includes('rel="apple-touch-icon"'), 'index.html must have apple-touch-icon link');
});
