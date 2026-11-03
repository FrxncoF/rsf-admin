import pg from 'pg';

// DATE (oid 1082) como string 'YYYY-MM-DD' para evitar corrimientos por zona horaria
pg.types.setTypeParser(1082, (value) => value);

// La conexión se configura con las variables estándar PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT
export const pool = new pg.Pool({
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[db] error inesperado en cliente inactivo', err);
});

export const query = (text, params) => pool.query(text, params);

/** Ejecuta `fn(client)` dentro de BEGIN/COMMIT; hace ROLLBACK si algo falla. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function waitForDb({ retries = 20, delayMs = 1500 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[db] esperando base de datos (${attempt}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
