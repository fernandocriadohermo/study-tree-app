use std::fs;
use std::io;
use std::path::PathBuf;
use std::time::Duration;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use super::migrations::apply_migrations;

pub fn open_database(app_handle: &AppHandle) -> Result<Connection, io::Error> {
    let app_dir = app_handle.path().app_local_data_dir().map_err(|error| {
        io::Error::other(format!(
            "No se pudo resolver el directorio local de datos: {error}"
        ))
    })?;

    fs::create_dir_all(&app_dir).map_err(|error| {
        io::Error::other(format!(
            "No se pudo crear el directorio local de datos: {error}"
        ))
    })?;

    let db_path = build_database_path(app_dir);

    let connection = Connection::open(db_path)
        .map_err(|error| io::Error::other(format!("No se pudo abrir SQLite: {error}")))?;

    configure_connection(&connection)?;
    apply_migrations(&connection).map_err(|message| {
        io::Error::other(format!("No se pudieron aplicar migraciones: {message}"))
    })?;

    Ok(connection)
}

fn build_database_path(app_dir: PathBuf) -> PathBuf {
    app_dir.join("study_tree.sqlite3")
}

fn configure_connection(connection: &Connection) -> Result<(), io::Error> {
    connection
        .busy_timeout(Duration::from_millis(5_000))
        .map_err(|error| {
            io::Error::other(format!("No se pudo configurar busy_timeout: {error}"))
        })?;

    connection
        .execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = FULL;
            "#,
        )
        .map_err(|error| {
            io::Error::other(format!(
                "No se pudieron aplicar los PRAGMA de SQLite: {error}"
            ))
        })?;

    Ok(())
}
