// Usage: node render.mjs stills <outDir> t1 t2 ...   |   node render.mjs frames <outDir> [fps] [duration]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [mode, outDir, ...rest] = process.argv.slice(2);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(here, 'scene.html')).href);
await page.evaluate(() => window.ready);

async function shoot(t, file, type = 'png') {
  await page.evaluate((tt) => window.render(tt), t);
  await page.screenshot({ path: file, type, ...(type === 'jpeg' ? { quality: 95 } : {}) });
}

if (mode === 'stills') {
  for (const t of rest.map(Number)) await shoot(t, path.join(outDir, `still-${t.toFixed(2)}.png`));
} else {
  const fps = Number(rest[0] ?? 30), dur = Number(rest[1] ?? 20);
  const total = Math.round(fps * dur);
  for (let i = 0; i < total; i++) {
    await shoot(i / fps, path.join(outDir, `f${String(i).padStart(4, '0')}.jpg`), 'jpeg');
    if (i % 60 === 0) console.log(`frame ${i}/${total}`);
  }
}
await browser.close();
console.log('done');
