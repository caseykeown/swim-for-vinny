#!/usr/bin/env node
/**
 * build-gallery.js
 * Reads _gallery/ markdown files and injects gallery data directly
 * into index.html as an inline script variable — no separate JSON
 * file needed, no static file serving issues.
 *
 * IMPORTANT: normalizes CRLF -> LF before parsing front matter, since
 * files committed from Windows machines (or via git with autocrlf)
 * can have \r\n line endings that silently break a \n-only regex.
 */

const fs   = require('fs');
const path = require('path');

const GALLERY_DIR  = path.join(__dirname, '_gallery');
const INDEX_FILE   = path.join(__dirname, 'index.html');

function parseFrontMatter(rawContent) {
  // Normalize all line endings to \n before matching. This is the fix:
  // previously \r\n line endings (common from Windows/git) caused the
  // regex to silently fail and return {}, dropping the gallery item.
  const content = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result = {};
  yaml.split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val === 'true')  val = true;
    if (val === 'false') val = false;
    result[key] = val;
  });
  return result;
}

const HARDCODED = [
  { type: 'photo', photo: 'isr-1.jpeg',  title: 'ISR lesson', published: true },
  { type: 'photo', photo: 'isr-2.jpeg',  title: 'ISR lesson', published: true },
  { type: 'photo', photo: 'isr-3.jpeg',  title: 'ISR lesson', published: true },
  { type: 'photo', photo: 'isr-4.jpeg',  title: 'ISR lesson', published: true },
  { type: 'photo', photo: 'isr-5.jpeg',  title: 'ISR lesson', published: true },
  { type: 'photo', photo: 'isr-6.jpeg',  title: 'ISR lesson', published: true },
  { type: 'photo', photo: 'isr-7.png',   title: 'ISR lesson', published: true },
  { type: 'photo', photo: 'isr-8.png',   title: 'ISR lesson', published: true },
  {
    type: 'photo',
    photo: 'https://raw.githubusercontent.com/caseykeown/swim-for-vinny/main/Daphne-baby-in-water.png',
    title: 'Daphne with a baby in the water',
    published: true
  },
  {
    type: 'video',
    video_url: 'https://www.tiktok.com/@daphnemattingly/video/7643985709199658271',
    title: 'TikTok video',
    published: true
  },
  {
    type: 'video',
    video_url: 'https://www.tiktok.com/@daphnemattingly/video/7639901780742081822',
    title: 'TikTok video',
    published: true
  },
];

let cmsItems = [];
let skipped = [];
if (fs.existsSync(GALLERY_DIR)) {
  const files = fs.readdirSync(GALLERY_DIR).filter(f => f.endsWith('.md'));
  files.sort();
  files.forEach(f => {
    const raw = fs.readFileSync(path.join(GALLERY_DIR, f), 'utf8');
    const parsed = parseFrontMatter(raw);
    const hasContent = parsed.photo || parsed.video_url;
    const isPublished = parsed.published !== false;
    if (hasContent && isPublished) {
      cmsItems.push(parsed);
    } else {
      skipped.push({ file: f, reason: !hasContent ? 'no photo/video_url parsed' : 'published=false', parsed });
    }
  });
}

const allItems = [...HARDCODED, ...cmsItems];

// Read index.html and inject gallery data as an inline script
let html = fs.readFileSync(INDEX_FILE, 'utf8');

const galleryScript = `<script>window.__GALLERY_DATA__ = ${JSON.stringify(allItems)};</script>`;

if (html.includes('window.__GALLERY_DATA__')) {
  html = html.replace(/<script>window\.__GALLERY_DATA__[\s\S]*?<\/script>/, galleryScript);
} else {
  html = html.replace('</head>', galleryScript + '\n</head>');
}

fs.writeFileSync(INDEX_FILE, html);
console.log(`Injected ${allItems.length} gallery items into index.html (${cmsItems.length} from CMS)`);
if (skipped.length) {
  console.log(`WARNING: ${skipped.length} _gallery file(s) skipped:`);
  skipped.forEach(s => console.log(`  - ${s.file}: ${s.reason}`));
}
