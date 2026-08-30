import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const adminEmail = process.env.ADMIN_EMAIL || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';
const sessionSecret = process.env.SESSION_SECRET || '';
const dataDir = path.join(root, 'data');
const uploadDir = path.join(root, 'uploads');
const mediaFile = path.join(dataDir, 'media.json');
fs.mkdirSync(dataDir, { recursive: true }); fs.mkdirSync(uploadDir, { recursive: true });
const app = express(); const sessions = new Map();
const upload = multer({ dest: uploadDir, limits: { fileSize: 100 * 1024 * 1024 }, fileFilter: (_r, f, cb) => cb(null, /^(image|video)\//.test(f.mimetype)) });
const readMedia = () => { try { return JSON.parse(fs.readFileSync(mediaFile, 'utf8')); } catch { return []; } };
const writeMedia = value => fs.writeFileSync(mediaFile, JSON.stringify(value, null, 2));
const cookie = (req, name) => String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1);
const safeName = value => String(value || 'file').replace(/[^a-z0-9._-]/gi, '-').slice(0, 120);
const youtube = value => /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(value);
function admin(req, res, next) { if (!cookie(req, 'wolf_admin') || !sessions.has(cookie(req, 'wolf_admin'))) return res.status(401).json({ error: 'Admin authentication required' }); next(); }

app.use(express.json({ limit: '1mb' })); app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir, { maxAge: '7d' })); app.use(express.static(path.join(root, 'public')));
app.get('/api/media', (_req, res) => res.json(readMedia().filter(x => x.published !== false)));
const repositoryCache = { value: null, expires: 0 };
app.get('/api/repository', async (_req, res) => {
  if (repositoryCache.value && repositoryCache.expires > Date.now()) return res.json(repositoryCache.value);
  try {
    const response = await fetch('https://api.github.com/repos/WOLVAREX/silntwolf', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'WolfBot-Docs' } });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const repo = await response.json();
    repositoryCache.value = { name: repo.full_name, url: repo.html_url, description: repo.description, stars: repo.stargazers_count, forks: repo.forks_count };
    repositoryCache.expires = Date.now() + 5 * 60 * 1000;
    res.json(repositoryCache.value);
  } catch (error) { res.status(502).json({ error: 'Repository statistics are temporarily unavailable' }); }
});
app.get('/api/admin/me', admin, (_req, res) => res.json({ authenticated: true, email: adminEmail }));
app.post('/api/admin/login', (req, res) => {
  if (!adminEmail || !adminPassword || !sessionSecret) return res.status(503).json({ error: 'Admin credentials are not configured' });
  const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || '');
  const valid = email === adminEmail.toLowerCase() && crypto.timingSafeEqual(Buffer.from(crypto.createHmac('sha256', sessionSecret).update(password).digest('hex')), Buffer.from(crypto.createHmac('sha256', sessionSecret).update(adminPassword).digest('hex')));
  if (!valid) return res.status(401).json({ error: 'Invalid admin credentials' });
  const id = crypto.randomBytes(32).toString('hex'); sessions.set(id, { email, createdAt: Date.now() });
  res.setHeader('Set-Cookie', `wolf_admin=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`); res.json({ authenticated: true });
});
app.post('/api/admin/logout', (req, res) => { const id = cookie(req, 'wolf_admin'); if (id) sessions.delete(id); res.setHeader('Set-Cookie', 'wolf_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.json({ ok: true }); });
app.post('/api/admin/media', admin, upload.single('file'), (req, res) => {
  const title = String(req.body.title || '').trim(); const description = String(req.body.description || '').trim(); const youtubeUrl = String(req.body.youtubeUrl || '').trim();
  if (!title) return res.status(400).json({ error: 'A title is required' }); if (!req.file && !youtubeUrl) return res.status(400).json({ error: 'Upload a file or provide a YouTube URL' }); if (youtubeUrl && !youtube(youtubeUrl)) return res.status(400).json({ error: 'Only YouTube URLs are supported' });
  const item = { id: crypto.randomUUID(), title, description, type: req.file ? (req.file.mimetype.startsWith('video/') ? 'video' : 'image') : 'youtube', url: req.file ? `/uploads/${req.file.filename}-${safeName(req.file.originalname)}` : youtubeUrl, originalName: req.file?.originalname || null, createdAt: new Date().toISOString(), published: true };
  if (req.file) fs.renameSync(req.file.path, path.join(uploadDir, `${req.file.filename}-${safeName(req.file.originalname)}`)); const items = readMedia(); items.unshift(item); writeMedia(items); res.status(201).json(item);
});
app.delete('/api/admin/media/:id', admin, (req, res) => { const items = readMedia(); const item = items.find(x => x.id === req.params.id); if (!item) return res.status(404).json({ error: 'Media item not found' }); if (item.type !== 'youtube') try { fs.unlinkSync(path.join(root, item.url.replace(/^\//, ''))); } catch {} writeMedia(items.filter(x => x.id !== item.id)); res.json({ ok: true }); });
app.use((_req, res) => res.sendFile(path.join(root, 'public', 'index.html')));
app.listen(port, () => console.log(`WolfBot Docs running on port ${port}`));
