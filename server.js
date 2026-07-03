require('dotenv').config();
const express = require('express');
const { Client, Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_NAME = process.env.DB_NAME || 'el_archivo';

const baseDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
};

let pool;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname)));

async function databaseExists() {
  const client = new Client({ ...baseDbConfig, database: 'postgres' });
  await client.connect();
  const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
  await client.end();
  return result.rowCount > 0;
}

async function createDatabase() {
  const client = new Client({ ...baseDbConfig, database: 'postgres' });
  await client.connect();
  await client.query(`CREATE DATABASE "${DB_NAME}" WITH ENCODING 'UTF8'`);
  await client.end();
}

async function ensureTables() {
  const client = new Client({ ...baseDbConfig, database: DB_NAME });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog (
      id VARCHAR(50) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      image TEXT,
      link TEXT,
      category VARCHAR(20) NOT NULL CHECK (category IN ('series', 'pelicula', 'drama', 'anime', 'lectura')),
      subtype VARCHAR(20) CHECK (subtype IS NULL OR subtype IN ('manga', 'manhwa')),
      status VARCHAR(20) DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en-curso', 'completado')),
      who VARCHAR(10) DEFAULT '',
      seasons JSONB,
      volumes JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_catalog_category ON catalog (category)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_catalog_status ON catalog (status)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_catalog_who ON catalog (who)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_catalog_updated ON catalog (updated_at)');

  await client.query(`
    CREATE TABLE IF NOT EXISTS covers (
      category VARCHAR(20) PRIMARY KEY,
      image_url TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    INSERT INTO covers (category, image_url) VALUES
      ('series', ''),
      ('pelicula', ''),
      ('drama', ''),
      ('anime', ''),
      ('lectura', '')
    ON CONFLICT (category) DO NOTHING
  `);

  await client.end();
}

async function ensureDatabase() {
  if (!(await databaseExists())) {
    await createDatabase();
    console.log(`Base de datos creada: ${DB_NAME}`);
  }
  await ensureTables();
}

function createPool() {
  pool = new Pool({ ...baseDbConfig, database: DB_NAME });
}

async function testConnection() {
  try {
    await ensureDatabase();
    createPool();
    const client = await pool.connect();
    console.log(`Conexion a PostgreSQL establecida. Base de datos lista: ${DB_NAME}`);
    client.release();
  } catch (error) {
    console.error('Error conectando a PostgreSQL:', error.message);
    console.error('Revisa que PostgreSQL este iniciado y que .env tenga DB_USER y DB_PASSWORD correctos.');
    process.exit(1);
  }
}

app.get('/api/catalog', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM catalog ORDER BY updated_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo catalogo:', error);
    res.status(500).json({ error: 'Error obteniendo catalogo' });
  }
});

app.post('/api/catalog', async (req, res) => {
  const client = await pool.connect();
  try {
    const catalog = req.body;
    if (!Array.isArray(catalog)) {
      return res.status(400).json({ error: 'El catalogo debe ser una lista' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM catalog');

    for (const item of catalog) {
      await client.query(
        `INSERT INTO catalog
          (id, title, image, link, category, subtype, status, who, seasons, volumes, updated_at)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, CURRENT_TIMESTAMP)`,
        [
          item.id,
          item.title,
          item.image || null,
          item.link || null,
          item.category,
          item.subtype || null,
          item.status || 'pendiente',
          item.who || '',
          item.seasons ? JSON.stringify(item.seasons) : null,
          item.volumes ? JSON.stringify(item.volumes) : null
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Catalogo guardado' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error guardando catalogo:', error);
    res.status(500).json({ error: 'Error guardando catalogo' });
  } finally {
    client.release();
  }
});

app.get('/api/covers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM covers');
    const covers = {};
    result.rows.forEach(row => {
      covers[row.category] = row.image_url;
    });
    res.json(covers);
  } catch (error) {
    console.error('Error obteniendo portadas:', error);
    res.status(500).json({ error: 'Error obteniendo portadas' });
  }
});

app.post('/api/covers', async (req, res) => {
  try {
    const covers = req.body || {};

    for (const [category, imageUrl] of Object.entries(covers)) {
      await pool.query(
        `INSERT INTO covers (category, image_url, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (category)
         DO UPDATE SET image_url = EXCLUDED.image_url, updated_at = CURRENT_TIMESTAMP`,
        [category, imageUrl]
      );
    }

    res.json({ success: true, message: 'Portadas guardadas' });
  } catch (error) {
    console.error('Error guardando portadas:', error);
    res.status(500).json({ error: 'Error guardando portadas' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

start();
