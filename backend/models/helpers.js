const path = require('path');
const { getBackendBaseUrl } = require('./config');

function buildPreviewUrlStatic(filename) {
  return `${getBackendBaseUrl()}/preview/${encodeURIComponent(filename)}`;
}

function parseGrsaiSse(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const lines = raw.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || !line.startsWith('data:')) continue;
    const payload = line.slice('data:'.length).trim();
    if (!payload || payload === '[DONE]') continue;
    try { return JSON.parse(payload); } catch { continue; }
  }
  return null;
}

function buildPreviewUrl(req, filename) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/preview/${encodeURIComponent(filename)}`;
}

function mapItemRow(req, row) {
  const imageFilename = row.image_path ? path.basename(row.image_path) : null;
  const thumbFilename = row.thumbnail_path ? path.basename(row.thumbnail_path) : null;

  return {
    id: row.id,
    user_id: row.user_id,
    wardrobe_id: row.wardrobe_id,
    type: row.type,
    subtype: row.subtype,
    name: row.name,
    brand: row.brand,
    notes: row.notes,
    favorite: !!row.favorite,
    status: row.status,
    primary_color: row.primary_color,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags || '{}') : row.tags,
    colors: typeof row.colors === 'string' ? JSON.parse(row.colors || '[]') : row.colors,
    wear_count: row.wear_count,
    suggestion_count: row.suggestion_count,
    needs_wash: !!row.needs_wash,
    image_url: imageFilename ? buildPreviewUrl(req, imageFilename) : null,
    thumbnail_url: thumbFilename ? buildPreviewUrl(req, thumbFilename) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

module.exports = { buildPreviewUrl, buildPreviewUrlStatic, parseGrsaiSse, mapItemRow };
