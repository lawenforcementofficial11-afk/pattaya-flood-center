// Storage adapter: Postgres when DATABASE_URL is set, otherwise JSON file (data/db.json + data/uploads)
const fs = require('fs'), path = require('path');
function fileStore(dir) {
  const UP = path.join(dir, 'uploads'), F = path.join(dir, 'db.json'); fs.mkdirSync(UP, { recursive: true });
  return {
    kind: 'file',
    async load() { try { return JSON.parse(fs.readFileSync(F, 'utf8')); } catch { return {}; } },
    async save(db) { const t = F + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 1)); fs.renameSync(t, F); },
    async putPhoto(name, mime, buf) { fs.writeFileSync(path.join(UP, name), buf); },
    async getPhoto(name) { try { const buf = fs.readFileSync(path.join(UP, path.basename(name))); const ext = path.extname(name).slice(1); return { mime: ext === 'jpg' ? 'image/jpeg' : 'image/' + ext, buf }; } catch { return null; } },
    async delPhoto(name) { fs.rm(path.join(UP, path.basename(name)), () => {}); },
  };
}
function pgStore(url) {
  const { Pool } = require('pg');
  const ssl = /localhost|127\.0\.0\.1|sslmode=disable/.test(url) ? false : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString: url, ssl, max: 4 });
  const ready = pool.query(`CREATE TABLE IF NOT EXISTS pfc_kv (k text PRIMARY KEY, v jsonb NOT NULL, updated_at timestamptz DEFAULT now());
    CREATE TABLE IF NOT EXISTS pfc_photos (name text PRIMARY KEY, mime text NOT NULL, data bytea NOT NULL, created_at timestamptz DEFAULT now());`);
  const last = {};
  return {
    kind: 'postgres',
    async load() { await ready; const r = await pool.query('SELECT k, v FROM pfc_kv'); const db = {}; for (const row of r.rows) { db[row.k] = row.v; last[row.k] = JSON.stringify(row.v); } return db; },
    async save(db) {
      await ready; const c = await pool.connect();
      try { await c.query('BEGIN');
        for (const [k, v] of Object.entries(db)) { const s = JSON.stringify(v); if (last[k] === s) continue; await c.query('INSERT INTO pfc_kv (k, v, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = now()', [k, s]); last[k] = s; }
        await c.query('COMMIT'); } catch (e) { await c.query('ROLLBACK').catch(() => {}); for (const k in last) delete last[k]; throw e; } finally { c.release(); }
    },
    async putPhoto(name, mime, buf) { await ready; await pool.query('INSERT INTO pfc_photos (name, mime, data) VALUES ($1,$2,$3) ON CONFLICT (name) DO NOTHING', [name, mime, buf]); },
    async getPhoto(name) { await ready; const r = await pool.query('SELECT mime, data FROM pfc_photos WHERE name=$1', [path.basename(name)]); return r.rows[0] ? { mime: r.rows[0].mime, buf: r.rows[0].data } : null; },
    async delPhoto(name) { await ready; await pool.query('DELETE FROM pfc_photos WHERE name=$1', [path.basename(name)]); },
  };
}
module.exports = (dataDir) => process.env.DATABASE_URL ? pgStore(process.env.DATABASE_URL) : fileStore(dataDir);
