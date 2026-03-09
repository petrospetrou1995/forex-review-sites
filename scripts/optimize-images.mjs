import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = process.cwd();

function listSiteDirs() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^site\d+-/i.test(e.name))
    .map((e) => e.name);
}

function walkHtml(absDir) {
  const out = [];
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(absDir, e.name);
    if (e.isDirectory()) out.push(...walkHtml(abs));
    else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) out.push(abs);
  }
  return out;
}

function shouldSkipHtml(absPath) {
  const base = path.basename(absPath);
  return /^google[a-z0-9]+\.html$/i.test(base);
}

function sha1(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isHttp(url) {
  return /^https?:\/\//i.test(url);
}

function isRasterUrl(u) {
  return /\.(png|jpe?g|gif|bmp|tiff)(\?.*)?$/i.test(u);
}

function stripQuery(u) {
  return String(u || '').split('?')[0];
}

function extOf(u) {
  const p = stripQuery(u);
  const m = p.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; BrokerProReviewsBot/1.0; +https://brokerproreviews.com/)',
      accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function ensureDir(absDir) {
  fs.mkdirSync(absDir, { recursive: true });
}

async function toWebp({ inputBuffer, inputPath, outputAbs, width, height }) {
  ensureDir(path.dirname(outputAbs));
  const s = inputBuffer ? sharp(inputBuffer) : sharp(inputPath);
  const pipeline = (width && height) ? s.resize(width, height, { fit: 'cover' }) : s;
  await pipeline.webp({ quality: 82 }).toFile(outputAbs);
}

function parseImgTags(html) {
  const out = [];
  const re = /<img\b[^>]*>/gi;
  const srcRe = /\bsrc="([^"]+)"/i;
  const altRe = /\balt="([^"]*)"/i;
  const wRe = /\bwidth="(\d+)"/i;
  const hRe = /\bheight="(\d+)"/i;

  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const src = tag.match(srcRe)?.[1] || '';
    if (!src) continue;
    const alt = tag.match(altRe)?.[1] || '';
    const width = Number(tag.match(wRe)?.[1]);
    const height = Number(tag.match(hRe)?.[1]);
    out.push({ tag, src, alt, width: Number.isFinite(width) ? width : null, height: Number.isFinite(height) ? height : null });
  }
  return out;
}

function replaceSrc(html, oldSrc, newSrc) {
  // Replace only exact src="oldSrc" occurrences.
  const esc = oldSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\bsrc="${esc}"`, 'g');
  return html.replace(re, `src="${newSrc}"`);
}

function resolveLocalAbs(siteDir, htmlAbsPath, src) {
  // src in HTML is usually relative. If it starts with '/', treat as site-root.
  const s = String(src || '');
  if (s.startsWith('/')) return path.join(ROOT, siteDir, s.replace(/^\//, ''));
  return path.resolve(path.dirname(htmlAbsPath), s);
}

function relFromHtml(htmlAbsPath, targetAbs) {
  let rel = path.relative(path.dirname(htmlAbsPath), targetAbs).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function classifyOutput({ siteDir, alt, src }) {
  const altLower = String(alt || '').toLowerCase();
  if (altLower.includes('logo') || /broker-logo-img/.test(src)) return { folder: 'assets/brokers', base: slugify(altLower.replace(/\s*logo\s*$/, '')) || 'logo' };
  if (altLower.includes('avatar') || altLower.includes('editorial') || altLower.includes('team') || altLower.split(' ').length <= 3) {
    const base = slugify(altLower) || `img-${sha1(src)}`;
    return { folder: 'assets/team', base };
  }
  return { folder: 'assets/images', base: `img-${sha1(src)}` };
}

async function optimizeHtmlFile({ siteDir, htmlAbsPath }) {
  const html = fs.readFileSync(htmlAbsPath, 'utf8');
  const imgs = parseImgTags(html);
  if (!imgs.length) return { changed: false, converted: 0, downloaded: 0 };

  let next = html;
  let converted = 0;
  let downloaded = 0;

  for (const img of imgs) {
    const { src, alt } = img;
    if (!src || src.toLowerCase().endsWith('.webp')) continue;

    const { folder, base } = classifyOutput({ siteDir, alt, src });
    const outAbs = path.join(ROOT, siteDir, folder, `${base}.webp`);

    try {
      if (isHttp(src)) {
        if (!isRasterUrl(src) && extOf(src) !== 'svg') {
          // Skip unknown remote types.
          continue;
        }
        if (!fs.existsSync(outAbs)) {
          const buf = await fetchBuffer(src);
          downloaded += 1;
          await toWebp({ inputBuffer: buf, outputAbs: outAbs, width: img.width, height: img.height });
          converted += 1;
        }
      } else {
        const inAbs = resolveLocalAbs(siteDir, htmlAbsPath, src);
        if (!fs.existsSync(inAbs)) continue;
        if (!fs.existsSync(outAbs)) {
          await toWebp({ inputPath: inAbs, outputAbs: outAbs, width: img.width, height: img.height });
          converted += 1;
        }
      }

      // Update HTML to reference the new .webp (relative path).
      const newSrc = relFromHtml(htmlAbsPath, outAbs);
      next = replaceSrc(next, src, newSrc);
    } catch {
      // If conversion fails for this image, keep original reference.
    }
  }

  if (next !== html) fs.writeFileSync(htmlAbsPath, next, 'utf8');
  return { changed: next !== html, converted, downloaded };
}

async function run() {
  const sites = listSiteDirs();
  let htmlChanged = 0;
  let totalConverted = 0;
  let totalDownloaded = 0;

  for (const siteDir of sites) {
    const absSite = path.join(ROOT, siteDir);
    const htmlFiles = walkHtml(absSite).filter((p) => !shouldSkipHtml(p));
    for (const htmlAbsPath of htmlFiles) {
      const r = await optimizeHtmlFile({ siteDir, htmlAbsPath });
      if (r.changed) htmlChanged += 1;
      totalConverted += r.converted;
      totalDownloaded += r.downloaded;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[images] htmlChanged=${htmlChanged} converted=${totalConverted} downloaded=${totalDownloaded}`);
}

await run();

