pub mod connection;
pub mod migrations;
pub mod models;
pub mod repository;

use std::sync::Mutex;

use repository::Database;

pub struct DatabaseState {
    pub db: Mutex<Database>,
}

impl DatabaseState {
    pub fn new(db: Database) -> Self {
        Self { db: Mutex::new(db) }
    }
}
