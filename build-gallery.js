#!/usr/bin/env node
/**
 * build-gallery.js
 *
 * Cloudflare Pages calls this as the build command:
 *   node build-gallery.js
 *
 * It reads every markdown file in _gallery/, parses the YAML
 * front matter, and writes a single gallery.json that the
 * carousel JS reads at page load. Only items with published: true
 * (or published omitted) are included.
 *
 * This means:
 *   - Daphne uploads a photo via /admin
 *   - Decap commits a new .md file to _gallery/
 *   - Cloudflare Pages sees the commit and runs this script
 *   - gallery.json is updated, carousel reflects the new photo
 *   - No manual code edits required ever again
 */

const fs   = require('fs');
const path = require('path');

const GALLERY_DIR = path.join(__dirname, '_gallery');
const OUTPUT_FILE = path.join(__dirname, 'gallery.json');

// Minimal YAML front-matter parser (no dependencies)
function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result = {};
  yaml.split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();
    // Remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Parse booleans
    if (val === 'true')  val = true;
    if (val === 'false') val = false;
    result[key] = val;
  });
  return result;
}

// Read existing hardcoded slides as the base set
// so existing photos are still present before Daphne adds any
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

// Collect CMS-managed items
let cmsItems = [];
if (fs.existsSync(GALLERY_DIR)) {
  const files = fs.readdirSync(GALLERY_DIR).filter(f => f.endsWith('.md'));
  files.sort(); // chronological by filename (YYYY-MM-DD prefix)
  cmsItems = files
    .map(f => parseFrontMatter(fs.readFileSync(path.join(GALLERY_DIR, f), 'utf8')))
    .filter(item => item.published !== false);
}

const allItems = [...HARDCODED, ...cmsItems];
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allItems, null, 2));
console.log(`gallery.json written: ${allItems.length} items (${cmsItems.length} from CMS)`);
