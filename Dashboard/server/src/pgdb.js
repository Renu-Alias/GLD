import pg from 'pg';

const { Pool } = pg;

export class PostgresDB {
  constructor({ connectionString } = {}) {
    const conn = connectionString || process.env.DATABASE_URL;
    if (!conn) {
      throw new Error('DATABASE_URL is not set');
    }
    this.pool = new Pool({ connectionString: conn });
    this.enabled = true;
  }

  async init() {
    // Ensure table exists (matches schema from DATABASE_SCHEMA.md)
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS leakage_history (
          id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          started_at  TIMESTAMPTZ NOT NULL,
          ended_at    TIMESTAMPTZ,
          peak_adc    SMALLINT NOT NULL CHECK (peak_adc BETWEEN 0 AND 1023),
          severity    VARCHAR(10) NOT NULL CHECK (severity IN ('warning', 'critical')),
          resolved    BOOLEAN GENERATED ALWAYS AS (ended_at IS NOT NULL) STORED,
          duration_ms BIGINT GENERATED ALWAYS AS (
            CASE
              WHEN ended_at IS NULL THEN NULL
              ELSE (EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000)::BIGINT
            END
          ) STORED,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT leakage_history_ends_after_start
            CHECK (ended_at IS NULL OR ended_at >= started_at)
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_leakage_history_started_at ON leakage_history (started_at DESC);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_leakage_history_severity ON leakage_history (severity, started_at DESC);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_leakage_history_active ON leakage_history (started_at DESC) WHERE ended_at IS NULL;`);
    } finally {
      client.release();
    }
  }

  async getAllHistory(limit = 1000) {
    try {
      const res = await this.pool.query(
        `SELECT id, started_at, ended_at, peak_adc, severity
         FROM leakage_history
         ORDER BY started_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.rows.map((row) => {
        const endedAt = row.ended_at;
        const startedAt = row.started_at;
        const resolved = endedAt != null;
        let duration_ms = null;
        if (resolved && startedAt && endedAt) {
          const start = new Date(startedAt).getTime();
          const end = new Date(endedAt).getTime();
          if (!isNaN(start) && !isNaN(end)) {
            duration_ms = Math.max(0, end - start);
          }
        }
        return {
          ...row,
          resolved,
          duration_ms,
        };
      });
    } catch (err) {
      console.error('[pgdb] getAllHistory error:', err.message);
      return [];
    }
  }

  async getActiveIncident() {
    const res = await this.pool.query(
      `SELECT id, started_at, peak_adc, severity
       FROM leakage_history
       WHERE ended_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`
    );
    return res.rows[0] || null;
  }

  async openIncident({ startedAtMs, peakAdc, severity }) {
    // Enforce at most 1 active incident
    const active = await this.pool.query(
      `SELECT id FROM leakage_history WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`
    );
    if (active.rows.length > 0) {
      return null;
    }
    const res = await this.pool.query(
      `INSERT INTO leakage_history (started_at, peak_adc, severity)
       VALUES (to_timestamp($1::double precision / 1000.0), $2, $3)
       RETURNING id, started_at, ended_at, peak_adc, severity`,
      [startedAtMs, peakAdc, severity]
    );
    const row = res.rows[0];
    if (row) {
      row.resolved = row.ended_at != null;
      row.duration_ms = null;
    }
    return row;
  }

  async closeActiveWithPeak({ endedAtMs, peakAdc }) {
    const res = await this.pool.query(
      `UPDATE leakage_history
       SET ended_at   = to_timestamp($1::double precision / 1000.0),
           peak_adc   = COALESCE($2, peak_adc)
       WHERE id = (SELECT id FROM leakage_history WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1)
         AND ended_at IS NULL
       RETURNING id, started_at, ended_at, peak_adc, severity`,
      [endedAtMs, peakAdc]
    );
    const row = res.rows[0];
    if (row) {
      row.resolved = true;
      if (row.started_at && row.ended_at) {
        const start = new Date(row.started_at).getTime();
        const end = new Date(row.ended_at).getTime();
        if (!isNaN(start) && !isNaN(end)) {
          row.duration_ms = Math.max(0, end - start);
        } else {
          row.duration_ms = null;
        }
      } else {
        row.duration_ms = null;
      }
    }
    return row || null;
  }

  async updateIncident({ id, peakAdc, severity }) {
    const res = await this.pool.query(
      `UPDATE leakage_history
       SET peak_adc   = GREATEST(peak_adc, $2),
           severity   = CASE
                            WHEN severity = 'critical' OR $3 = 'critical' THEN 'critical'
                            ELSE 'warning'
                        END
       WHERE id = $1 AND ended_at IS NULL
       RETURNING id, started_at, ended_at, peak_adc, severity`,
      [id, peakAdc, severity]
    );
    const row = res.rows[0];
    if (row) {
      row.resolved = row.ended_at != null;
      row.duration_ms = null;
    }
    return row || null;
  }

  async closeIncident({ id, endedAtMs }) {
    const res = await this.pool.query(
      `UPDATE leakage_history
       SET ended_at   = to_timestamp($1::double precision / 1000.0)
       WHERE id = $2 AND ended_at IS NULL
       RETURNING id, started_at, ended_at, peak_adc, severity`,
      [endedAtMs, id]
    );
    const row = res.rows[0];
    if (row) {
      row.resolved = true;
      if (row.started_at && row.ended_at) {
        const start = new Date(row.started_at).getTime();
        const end = new Date(row.ended_at).getTime();
        if (!isNaN(start) && !isNaN(end)) {
          row.duration_ms = Math.max(0, end - start);
        } else {
          row.duration_ms = null;
        }
      } else {
        row.duration_ms = null;
      }
    }
    return row || null;
  }

  async closeOrphanActiveAtStart() {
    // If bridge crashed while active, close orphan if needed (conservative)
    await this.pool.query(
      `UPDATE leakage_history
       SET ended_at   = COALESCE(ended_at, started_at),
           updated_at = now()
       WHERE ended_at IS NULL`
    );
  }

  async close() {
    try {
      await this.pool.end();
    } catch {}
  }
}
