import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db: Database.Database | null = null

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    absolutePath TEXT UNIQUE NOT NULL,
    originalPath TEXT NOT NULL,
    fileName TEXT NOT NULL,
    fileSize INTEGER DEFAULT 0,
    createdAt TEXT,
    modifiedAt TEXT,
    dateTaken TEXT,
    camera TEXT,
    lens TEXT,
    exposure TEXT,
    iso TEXT,
    width INTEGER,
    height INTEGER,
    thumbnailPath TEXT,
    physicalAlbumId TEXT,
    trashed INTEGER DEFAULT 0,
    rating INTEGER DEFAULT 0,
    colorLabel TEXT,
    phash TEXT,
    FOREIGN KEY (physicalAlbumId) REFERENCES albums(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('virtual', 'physical')) NOT NULL,
    folderPath TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS photo_albums (
    photoId TEXT NOT NULL,
    albumId TEXT NOT NULL,
    PRIMARY KEY (photoId, albumId),
    FOREIGN KEY (photoId) REFERENCES photos(id) ON DELETE CASCADE,
    FOREIGN KEY (albumId) REFERENCES albums(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS photo_tags (
    photoId TEXT NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY (photoId, tag),
    FOREIGN KEY (photoId) REFERENCES photos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS source_folders (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    addedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS light_tables (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS light_table_photos (
    tableId TEXT NOT NULL,
    photoId TEXT NOT NULL,
    x REAL NOT NULL DEFAULT 0,
    y REAL NOT NULL DEFAULT 0,
    width REAL NOT NULL DEFAULT 200,
    height REAL NOT NULL DEFAULT 200,
    zIndex INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (tableId, photoId),
    FOREIGN KEY (tableId) REFERENCES light_tables(id) ON DELETE CASCADE,
    FOREIGN KEY (photoId) REFERENCES photos(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_photos_trashed ON photos(trashed);
  CREATE INDEX IF NOT EXISTS idx_photos_physical_album ON photos(physicalAlbumId);
  CREATE INDEX IF NOT EXISTS idx_photos_filename ON photos(fileName);
  CREATE INDEX IF NOT EXISTS idx_photo_tags_tag ON photo_tags(tag);
  CREATE INDEX IF NOT EXISTS idx_photo_albums_album ON photo_albums(albumId);
`

export function initDatabase(): Database.Database {
  if (db) return db

  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) {
    console.log(`[DB] Creating database directory: ${dbDir}`)
    mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = join(dbDir, 'photoviewer.db')
  db = new Database(dbPath)

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run schema creation
  try {
    db.exec(SCHEMA_SQL)
    console.log('[DB] Schema applied successfully')

    // Ensure "Favorites" virtual album exists
    const favorites = db.prepare("SELECT id FROM albums WHERE name = 'Favorites' AND type = 'virtual'").get()
    if (!favorites) {
      const id = 'favorites-album' // Fixed ID for Favorites
      db.prepare("INSERT INTO albums (id, name, type) VALUES (?, 'Favorites', 'virtual')").run(id)
      console.log('[DB] Created default Favorites album')
    }

    // Migrations: add columns if they don't exist (for existing databases)
    try {
      db.exec('ALTER TABLE photos ADD COLUMN rating INTEGER DEFAULT 0')
      console.log('[DB] Added rating column')
    } catch { /* column already exists */ }
    try {
      db.exec('ALTER TABLE photos ADD COLUMN colorLabel TEXT')
      console.log('[DB] Added colorLabel column')
    } catch { /* column already exists */ }
    try {
      db.exec('ALTER TABLE photos ADD COLUMN phash TEXT')
      console.log('[DB] Added phash column')
    } catch { /* column already exists */ }

    // Run index creation after migrations ensure the columns exist
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_photos_phash ON photos(phash);
    `)

  } catch (err) {
    console.error('[DB] Error during initialization:', err)
    throw err
  }

  console.log(`[DB] Database initialized at ${dbPath}`)
  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('[DB] Database closed')
  }
}
