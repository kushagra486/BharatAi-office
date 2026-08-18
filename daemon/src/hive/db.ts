import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { ROSTER } from '@bharat-ai-office/shared';
import { env } from '../env';

const schemaPath = path.join(__dirname, 'schema.sql');

function openDatabase(): Database.Database {
  const dbPath = env.HIVE_DB_PATH;
  const dir = path.dirname(dbPath);
  if (dir && dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const isFirstRun = !fs.existsSync(dbPath);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  if (isFirstRun) {
    seedRoster(db);
  } else {
    // idempotent re-seed in case the roster changed between runs
    seedRoster(db);
  }

  return db;
}

function seedRoster(db: Database.Database) {
  const upsert = db.prepare(`
    INSERT INTO agents (id, name, role, dept, color, shape, home_x, home_y)
    VALUES (@id, @name, @role, @dept, @color, @shape, @home_x, @home_y)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, role = excluded.role, dept = excluded.dept,
      color = excluded.color, shape = excluded.shape,
      home_x = excluded.home_x, home_y = excluded.home_y
  `);
  const seedAll = db.transaction(() => {
    for (const agent of ROSTER) upsert.run(agent);
  });
  seedAll();
}

export const db = openDatabase();
