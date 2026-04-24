use rusqlite::Connection;

pub const MIGRATION_V1: &str = r#"
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
) STRICT;

CREATE TABLE IF NOT EXISTS nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  parent_id INTEGER NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  learning_status TEXT NOT NULL CHECK (
    learning_status IN ('sin_ver', 'visto', 'en_estudio', 'dominado')
  ),
  is_collapsed INTEGER NOT NULL CHECK (is_collapsed IN (0, 1)),
  sibling_order INTEGER NOT NULL CHECK (sibling_order >= 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id, parent_id) REFERENCES nodes(document_id, id) ON DELETE CASCADE,
  UNIQUE (document_id, id)
) STRICT;

CREATE TABLE IF NOT EXISTS node_content (
  node_id INTEGER PRIMARY KEY,
  note TEXT DEFAULT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS document_view_state (
  document_id INTEGER PRIMARY KEY,
  selected_node_id INTEGER NULL,
  pan_x REAL NOT NULL,
  pan_y REAL NOT NULL,
  zoom REAL NOT NULL CHECK (zoom > 0.0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (selected_node_id) REFERENCES nodes(id) ON DELETE SET NULL
) STRICT;

CREATE TABLE IF NOT EXISTS app_settings (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  last_opened_document_id INTEGER NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  FOREIGN KEY (last_opened_document_id) REFERENCES documents(id) ON DELETE SET NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_one_root_per_document
  ON nodes(document_id)
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_unique_sibling_order
  ON nodes(document_id, parent_id, sibling_order)
  WHERE parent_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_document_view_state_selected_node_same_document_insert
BEFORE INSERT ON document_view_state
FOR EACH ROW
WHEN NEW.selected_node_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1
   FROM nodes
   WHERE id = NEW.selected_node_id
     AND document_id = NEW.document_id
 )
BEGIN
  SELECT RAISE(ABORT, 'selected_node_id must belong to the same document');
END;

CREATE TRIGGER IF NOT EXISTS trg_document_view_state_selected_node_same_document_update
BEFORE UPDATE OF document_id, selected_node_id ON document_view_state
FOR EACH ROW
WHEN NEW.selected_node_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1
   FROM nodes
   WHERE id = NEW.selected_node_id
     AND document_id = NEW.document_id
 )
BEGIN
  SELECT RAISE(ABORT, 'selected_node_id must belong to the same document');
END;

INSERT OR IGNORE INTO app_settings (
  singleton_id,
  last_opened_document_id,
  updated_at
) VALUES (
  1,
  NULL,
  0
);
"#;

pub fn apply_migrations(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(MIGRATION_V1)
        .map_err(|error| format!("No se pudo aplicar la migración inicial: {error}"))?;

    Ok(())
}
