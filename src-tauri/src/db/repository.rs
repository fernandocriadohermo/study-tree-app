#[cfg(test)]
use std::path::Path;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension, Transaction};

#[cfg(test)]
use super::migrations::apply_migrations;
use super::models::{
    DocumentDto, DocumentListItemDto, DocumentViewStateDto, NodeDto, OpenDocumentSnapshotDto,
    SelectedNodeContentDto,
};

#[derive(Clone)]
struct CopyNodeSource {
    id: i64,
    parent_id: Option<i64>,
    title: String,
    learning_status: String,
    is_collapsed: i64,
    sibling_order: i64,
}

struct CopyNodeContentSource {
    node_id: i64,
    note: Option<String>,
    body: String,
}

pub struct Database {
    pub(crate) connection: Connection,
}

impl Database {
    pub fn new(connection: Connection) -> Self {
        Self { connection }
    }

    #[cfg(test)]
    pub fn open_for_test(path: &Path) -> Result<Self, String> {
        let connection = Connection::open(path)
            .map_err(|error| format!("No se pudo abrir SQLite de test: {error}"))?;

        connection
            .execute_batch(
                r#"
                PRAGMA foreign_keys = ON;
                PRAGMA journal_mode = WAL;
                PRAGMA synchronous = FULL;
                "#,
            )
            .map_err(|error| format!("No se pudieron aplicar los PRAGMA de test: {error}"))?;

        apply_migrations(&connection)?;

        Ok(Self { connection })
    }

    pub fn list_documents(&self) -> Result<Vec<DocumentListItemDto>, String> {
        let mut statement = self
            .connection
            .prepare(
                r#"
                SELECT id, title, created_at, updated_at
                FROM documents
                ORDER BY updated_at DESC, id DESC
                "#,
            )
            .map_err(|error| format!("No se pudo preparar list_documents: {error}"))?;

        let rows = statement
            .query_map([], |row| {
                Ok(DocumentListItemDto {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .map_err(|error| format!("No se pudo ejecutar list_documents: {error}"))?;

        let mut documents = Vec::new();

        for row in rows {
            documents.push(
                row.map_err(|error| format!("No se pudo leer una fila de documents: {error}"))?,
            );
        }

        Ok(documents)
    }

    pub fn create_document(&mut self, title: String) -> Result<OpenDocumentSnapshotDto, String> {
        let normalized_title = normalize_node_title(title)?;
        let now = now_ts();

        let transaction = self.connection.transaction().map_err(|error| {
            format!("No se pudo iniciar la transacción de create_document: {error}")
        })?;

        let document_id = insert_document(&transaction, &normalized_title, now)?;
        let root_node_id = insert_root_node(&transaction, document_id, &normalized_title, now)?;
        insert_node_content(&transaction, root_node_id, now)?;
        update_document_view_state_selection(&transaction, document_id, root_node_id, now)?;
        update_last_opened_document_id(&transaction, document_id, now)?;

        transaction
            .commit()
            .map_err(|error| format!("No se pudo confirmar create_document: {error}"))?;

        let snapshot = self
            .load_document_snapshot(document_id)?
            .ok_or_else(|| format!("Documento {document_id} creado pero no recuperable"))?;

        if snapshot.root_node_id != root_node_id {
            return Err("El root recuperado no coincide con el root recién creado".to_string());
        }

        Ok(snapshot)
    }

    pub fn open_document(
        &mut self,
        document_id: i64,
    ) -> Result<Option<OpenDocumentSnapshotDto>, String> {
        let now = now_ts();

        let transaction = self.connection.transaction().map_err(|error| {
            format!("No se pudo iniciar la transacción de open_document: {error}")
        })?;

        let exists = transaction
            .query_row(
                r#"
                SELECT id
                FROM documents
                WHERE id = ?1
                "#,
                [document_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| {
                format!("No se pudo verificar la existencia del documento {document_id}: {error}")
            })?;

        if exists.is_none() {
            return Ok(None);
        }

        update_last_opened_document_id(&transaction, document_id, now)?;

        transaction
            .commit()
            .map_err(|error| format!("No se pudo confirmar open_document: {error}"))?;

        self.load_document_snapshot(document_id)
    }

    pub fn open_last_opened_document(&mut self) -> Result<Option<OpenDocumentSnapshotDto>, String> {
        let last_opened_document_id = self
            .connection
            .query_row(
                r#"
                SELECT last_opened_document_id
                FROM app_settings
                WHERE singleton_id = 1
                "#,
                [],
                |row| row.get::<_, Option<i64>>(0),
            )
            .map_err(|error| {
                format!("No se pudo leer app_settings.last_opened_document_id: {error}")
            })?;

        let Some(document_id) = last_opened_document_id else {
            return Ok(None);
        };

        self.open_document(document_id)
    }

        pub fn delete_document(
        &mut self,
        document_id: i64,
    ) -> Result<Option<OpenDocumentSnapshotDto>, String> {
        let transaction = self.connection.transaction().map_err(|error| {
            format!("No se pudo iniciar la transacción de delete_document: {error}")
        })?;

        let document_exists = transaction
            .query_row(
                r#"
                SELECT id
                FROM documents
                WHERE id = ?1
                "#,
                [document_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| format!("No se pudo comprobar el documento {document_id}: {error}"))?;

        if document_exists.is_none() {
            return Ok(None);
        }

        transaction
            .execute(
                r#"
                DELETE FROM documents
                WHERE id = ?1
                "#,
                [document_id],
            )
            .map_err(|error| format!("No se pudo borrar el documento {document_id}: {error}"))?;

        let next_document_id = transaction
            .query_row(
                r#"
                SELECT id
                FROM documents
                ORDER BY updated_at DESC, id DESC
                LIMIT 1
                "#,
                [],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| {
                format!("No se pudo seleccionar el siguiente documento tras borrar {document_id}: {error}")
            })?;

        if let Some(next_document_id) = next_document_id {
            let now = now_ts();
            update_last_opened_document_id(&transaction, next_document_id, now)?;
        }

        transaction
            .commit()
            .map_err(|error| format!("No se pudo confirmar delete_document: {error}"))?;

        match next_document_id {
            Some(next_document_id) => self.load_document_snapshot(next_document_id),
            None => Ok(None),
        }
    }

        pub fn copy_document(
        &mut self,
        source_document_id: i64,
    ) -> Result<Option<OpenDocumentSnapshotDto>, String> {
        let now = now_ts();

        let transaction = self.connection.transaction().map_err(|error| {
            format!("No se pudo iniciar la transacción de copy_document: {error}")
        })?;

        let source_document_title = transaction
            .query_row(
                r#"
                SELECT title
                FROM documents
                WHERE id = ?1
                "#,
                [source_document_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| {
                format!("No se pudo leer el documento origen {source_document_id}: {error}")
            })?;

        let Some(source_document_title) = source_document_title else {
            return Ok(None);
        };

        let copied_document_title = normalize_node_title(format!(
            "Copia de {source_document_title}",
        ))?;

        let copied_document_id = insert_document(
            &transaction,
            &copied_document_title,
            now,
        )?;

        let source_nodes = load_copy_node_sources(
            &transaction,
            source_document_id,
        )?;

        if source_nodes.is_empty() {
            return Err(format!(
                "El documento origen {source_document_id} no tiene nodos para copiar",
            ));
        }

        let source_root_node_id = source_nodes
            .iter()
            .find(|node| node.parent_id.is_none())
            .map(|node| node.id)
            .ok_or_else(|| {
                format!("El documento origen {source_document_id} no tiene nodo root")
            })?;

        let copied_node_ids_by_source_id = copy_nodes_into_document(
            &transaction,
            copied_document_id,
            &source_nodes,
            now,
        )?;

        let copied_root_node_id = copied_node_ids_by_source_id
            .get(&source_root_node_id)
            .copied()
            .ok_or_else(|| {
                format!(
                    "No se pudo resolver el root copiado del documento origen {source_document_id}",
                )
            })?;

        copy_node_contents_into_document(
            &transaction,
            source_document_id,
            &copied_node_ids_by_source_id,
            now,
        )?;

        update_document_view_state_selection(
            &transaction,
            copied_document_id,
            copied_root_node_id,
            now,
        )?;

        update_last_opened_document_id(
            &transaction,
            copied_document_id,
            now,
        )?;

        transaction
            .commit()
            .map_err(|error| format!("No se pudo confirmar copy_document: {error}"))?;

        self.load_document_snapshot(copied_document_id)
    }

    pub fn update_node_content(
        &mut self,
        node_id: i64,
        note: Option<String>,
        body: String,
    ) -> Result<SelectedNodeContentDto, String> {
        let normalized_note = normalize_note(note)?;
        let now = now_ts();

        let transaction = self.connection.transaction().map_err(|error| {
            format!("No se pudo iniciar la transacción de update_node_content: {error}")
        })?;

        let document_id = transaction
            .query_row(
                r#"
                SELECT document_id
                FROM nodes
                WHERE id = ?1
                "#,
                [node_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| format!("No se pudo comprobar el nodo {node_id}: {error}"))?
            .ok_or_else(|| "El nodo indicado no existe".to_string())?;

        let affected_rows = transaction
            .execute(
                r#"
                UPDATE node_content
                SET
                  note = ?1,
                  body = ?2,
                  updated_at = ?3
                WHERE node_id = ?4
                "#,
                params![normalized_note, body, now, node_id],
            )
            .map_err(|error| format!("No se pudo actualizar node_content: {error}"))?;

        if affected_rows != 1 {
            return Err("No existe contenido persistido para el nodo indicado".to_string());
        }

        update_document_updated_at(&transaction, document_id, now)?;

        transaction
            .commit()
            .map_err(|error| format!("No se pudo confirmar update_node_content: {error}"))?;

        self.get_node_content_by_id(node_id)?
            .ok_or_else(|| "El contenido actualizado no pudo recuperarse".to_string())
    }

    pub fn create_child_node(
        &mut self,
        parent_node_id: i64,
        title: String,
    ) -> Result<OpenDocumentSnapshotDto, String> {
        let normalized_title = normalize_node_title(title)?;
        let now = now_ts();

        let transaction = self.connection.transaction().map_err(|error| {
            format!("No se pudo iniciar la transacción de create_child_node: {error}")
        })?;

        let document_id = transaction
            .query_row(
                r#"
                SELECT document_id
                FROM nodes
                WHERE id = ?1
                "#,
                [parent_node_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| {
                format!("No se pudo comprobar el nodo padre {parent_node_id}: {error}")
            })?
            .ok_or_else(|| "El nodo padre indicado no existe".to_string())?;

        let next_sibling_order = transaction
            .query_row(
                r#"
                SELECT COALESCE(MAX(sibling_order) + 1, 0)
                FROM nodes
                WHERE document_id = ?1
                  AND parent_id = ?2
                "#,
                params![document_id, parent_node_id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| format!("No se pudo calcular sibling_order del hijo: {error}"))?;

        let child_node_id = insert_child_node(
            &transaction,
            document_id,
            parent_node_id,
            &normalized_title,
            next_sibling_order,
            now,
        )?;

        insert_node_content(&transaction, child_node_id, now)?;
        recalculate_learning_status_upwards(&transaction, document_id, Some(parent_node_id), now)?;
        update_document_view_state_selection(&transaction, document_id, child_node_id, now)?;
        update_document_updated_at(&transaction, document_id, now)?;
        update_last_opened_document_id(&transaction, document_id, now)?;

        transaction
            .commit()
            .map_err(|error| format!("No se pudo confirmar create_child_node: {error}"))?;

        self.load_document_snapshot(document_id)?
            .ok_or_else(|| "No se pudo reconstruir el snapshot tras crear el hijo".to_string())
    }

    pub fn select_node(
        &mut self,
        document_id: i64,
        node_id: i64,
    ) -> Result<Option<OpenDocumentSnapshotDto>, String> {
        let now = now_ts();

        let transaction = self.connection.transaction().map_err(|error| {
            format!("No se pudo iniciar la transacción de select_node: {error}")
        })?;

        let document_exists = transaction
            .query_row(
                r#"
                SELECT id
                FROM documents
                WHERE id = ?1
                "#,
                [document_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| format!("No se pudo comprobar el documento {document_id}: {error}"))?;

        if document_exists.is_none() {
            return Ok(None);
        }

        let node_exists_in_document = transaction
            .query_row(
                r#"
                SELECT id
                FROM nodes
                WHERE id = ?1
                  AND document_id = ?2
                "#,
                params![node_id, document_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| format!("No se pudo comprobar el nodo {node_id}: {error}"))?;

        if node_exists_in_document.is_none() {
            return Err("El nodo indicado no pertenece al documento activo".to_string());
        }

        update_document_view_state_selection(&transaction, document_id, node_id, now)?;
        update_last_opened_document_id(&transaction, document_id, now)?;

        transaction
            .commit()
            .map_err(|error| format!("No se pudo confirmar select_node: {error}"))?;

        self.load_document_snapshot(document_id)
    }

    pub fn set_node_collapsed(
        &mut self,
        document_id: i64,
        node_id: i64,
        is_collapsed: bool,
    ) -> Result<Option<OpenDocumentSnapshotDto>, String> {
        let now = now_ts();
        let is_collapsed_int = if is_collapsed { 1 } else { 0 };

        let transaction = self.connection.transaction().map_err(|error| {
            format!("No se pudo iniciar la transacción de set_node_collapsed: {error}")
        })?;

        let document_exists = transaction
            .query_row(
                r#"
                SELECT id
                FROM documents
                WHERE id = ?1
                "#,
                [document_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| format!("No se pudo comprobar el documento {document_id}: {error}"))?;

        if document_exists.is_none() {
            return Ok(None);
        }

        let node_exists_in_document = transaction
            .query_row(
                r#"
                SELECT id
                FROM nodes
                WHERE id = ?1
                  AND document_id = ?2
                "#,
                params![node_id, document_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| format!("No se pudo comprobar el nodo {node_id}: {error}"))?;

        if node_exists_in_document.is_none() {
            return Err("El nodo indicado no pertenece al documento activo".to_string());
        }

        let affected_rows = transaction
            .execute(
                r#"
                UPDATE nodes
                SET
                  is_collapsed = ?1,
                  updated_at = ?2
                WHERE id = ?3
                  AND document_id = ?4
                "#,
                params![is_collapsed_int, now, node_id, document_id],
            )
            .map_err(|error| format!("No se pudo actualizar nodes.is_collapsed: {error}"))?;

        if affected_rows != 1 {
            return Err("No se pudo actualizar el estado colapsado del nodo".to_string());
        }

        let current_selected_node_id = get_document_selected_node_id(&transaction, document_id)?;

        if is_collapsed {
            if let Some(selected_node_id) = current_selected_node_id {
                if selected_node_id != node_id
                    && is_descendant_of_node(&transaction, document_id, node_id, selected_node_id)?
                {
                    update_document_view_state_selection(&transaction, document_id, node_id, now)?;
                }
            }
        }

        update_last_opened_document_id(&transaction, document_id, now)?;

        transaction
            .commit()
            .map_err(|error| format!("No se pudo confirmar set_node_collapsed: {error}"))?;

        self.load_document_snapshot(document_id)
    }

    pub fn set_node_learning_status(
        &mut self,
        document_id: i64,
        node_id: i64,
        learning_status: String,
    ) -> Result<Option<OpenDocumentSnapshotDto>, String> {
        let normalized_learning_status = normalize_learning_status(learning_status)?;
        let now = now_ts();

        let transaction = self.connection.transaction().map_err(|error| {
            format!("No se pudo iniciar la transacción de set_node_learning_status: {error}")
        })?;

        let document_exists = transaction
            .query_row(
                r#"
                SELECT id
                FROM documents
                WHERE id = ?1
                "#,
                [document_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| format!("No se pudo comprobar el documento {document_id}: {error}"))?;

        if document_exists.is_none() {
            return Ok(None);
        }

        let node_parent_id = transaction
            .query_row(
                r#"
                SELECT parent_id
                FROM nodes
                WHERE id = ?1
                  AND document_id = ?2
                "#,
                params![node_id, document_id],
                |row| row.get::<_, Option<i64>>(0),
            )
            .optional()
            .map_err(|error| format!("No se pudo comprobar el nodo {node_id}: {error}"))?
            .ok_or_else(|| "El nodo indicado no pertenece al documento activo".to_string())?;

        if node_has_children(&transaction, document_id, node_id)? {
            return Err("Solo se puede cambiar manualmente el estado de nodos hoja".to_string());
        }

        let affected_rows = transaction
            .execute(
                r#"
                UPDATE nodes
                SET
                  learning_status = ?1,
                  updated_at = ?2
                WHERE id = ?3
                  AND document_id = ?4
                "#,
                params![normalized_learning_status, now, node_id, document_id],
            )
            .map_err(|error| format!("No se pudo actualizar nodes.learning_status: {error}"))?;

        if affected_rows != 1 {
            return Err("No se pudo actualizar el estado de aprendizaje del nodo".to_string());
        }

        recalculate_learning_status_upwards(&transaction, document_id, node_parent_id, now)?;
        update_document_updated_at(&transaction, document_id, now)?;
        update_last_opened_document_id(&transaction, document_id, now)?;

        transaction
            .commit()
            .map_err(|error| format!("No se pudo confirmar set_node_learning_status: {error}"))?;

        self.load_document_snapshot(document_id)
    }

    pub fn rename_node(
        &mut self,
        document_id: i64,
        node_id: i64,
        title: String,
    ) -> Result<Option<OpenDocumentSnapshotDto>, String> {
        let normalized_title = normalize_node_title(title)?;
        let now = now_ts();

        let transaction = self.connection.transaction().map_err(|error| {
            format!("No se pudo iniciar la transacción de rename_node: {error}")
        })?;

        let document_exists = transaction
            .query_row(
                r#"
                SELECT id
                FROM documents
                WHERE id = ?1
                "#,
                [document_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| format!("No se pudo comprobar el documento {document_id}: {error}"))?;

        if document_exists.is_none() {
            return Ok(None);
        }

        let node_parent_id = transaction
            .query_row(
                r#"
                SELECT parent_id
                FROM nodes
                WHERE id = ?1
                  AND document_id = ?2
                "#,
                params![node_id, document_id],
                |row| row.get::<_, Option<i64>>(0),
            )
            .optional()
            .map_err(|error| format!("No se pudo comprobar el nodo {node_id}: {error}"))?
            .ok_or_else(|| "El nodo indicado no pertenece al documento activo".to_string())?;

        let affected_rows = transaction
            .execute(
                r#"
                UPDATE nodes
                SET
                  title = ?1,
                  updated_at = ?2
                WHERE id = ?3
                  AND document_id = ?4
                "#,
                params![normalized_title, now, node_id, document_id],
            )
            .map_err(|error| format!("No se pudo actualizar nodes.title: {error}"))?;

        if affected_rows != 1 {
            return Err("No se pudo renombrar el nodo".to_string());
        }

        if node_parent_id.is_none() {
            transaction
                .execute(
                    r#"
                    UPDATE documents
                    SET
                      title = ?1,
                      updated_at = ?2
                    WHERE id = ?3
                    "#,
                    params![normalized_title, now, document_id],
                )
                .map_err(|error| format!("No se pudo actualizar documents.title: {error}"))?;
        } else {
            update_document_updated_at(&transaction, document_id, now)?;
        }

        update_last_opened_document_id(&transaction, document_id, now)?;

        transaction
            .commit()
            .map_err(|error| format!("No se pudo confirmar rename_node: {error}"))?;

        self.load_document_snapshot(document_id)
    }

    pub fn delete_leaf_node(
        &mut self,
        document_id: i64,
        node_id: i64,
    ) -> Result<Option<OpenDocumentSnapshotDto>, String> {
        let now = now_ts();

        let transaction = self.connection.transaction().map_err(|error| {
            format!("No se pudo iniciar la transacción de delete_leaf_node: {error}")
        })?;

        let document_exists = transaction
            .query_row(
                r#"
                SELECT id
                FROM documents
                WHERE id = ?1
                "#,
                [document_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| format!("No se pudo comprobar el documento {document_id}: {error}"))?;

        if document_exists.is_none() {
            return Ok(None);
        }

        let parent_id = transaction
            .query_row(
                r#"
                SELECT parent_id
                FROM nodes
                WHERE id = ?1
                  AND document_id = ?2
                "#,
                params![node_id, document_id],
                |row| row.get::<_, Option<i64>>(0),
            )
            .optional()
            .map_err(|error| format!("No se pudo comprobar el nodo {node_id}: {error}"))?
            .ok_or_else(|| "El nodo indicado no pertenece al documento activo".to_string())?;

        let parent_id = parent_id.ok_or_else(|| "No se puede eliminar el nodo root".to_string())?;

        let child_count = transaction
            .query_row(
                r#"
                SELECT COUNT(*)
                FROM nodes
                WHERE document_id = ?1
                  AND parent_id = ?2
                "#,
                params![document_id, node_id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| {
                format!("No se pudo comprobar si el nodo {node_id} tiene hijos: {error}")
            })?;

        if child_count > 0 {
            return Err("Solo se pueden eliminar nodos hoja".to_string());
        }

        let current_selected_node_id = get_document_selected_node_id(&transaction, document_id)?;

        if current_selected_node_id == Some(node_id) {
            update_document_view_state_selection(&transaction, document_id, parent_id, now)?;
        }

        transaction
            .execute(
                r#"
                DELETE FROM node_content
                WHERE node_id = ?1
                "#,
                [node_id],
            )
            .map_err(|error| format!("No se pudo eliminar node_content del nodo: {error}"))?;

        let affected_rows = transaction
            .execute(
                r#"
                DELETE FROM nodes
                WHERE id = ?1
                  AND document_id = ?2
                "#,
                params![node_id, document_id],
            )
            .map_err(|error| format!("No se pudo eliminar el nodo {node_id}: {error}"))?;

        if affected_rows != 1 {
            return Err("No se pudo eliminar el nodo hoja".to_string());
        }

        recalculate_learning_status_upwards(&transaction, document_id, Some(parent_id), now)?;
        update_document_updated_at(&transaction, document_id, now)?;
        update_last_opened_document_id(&transaction, document_id, now)?;

        transaction
            .commit()
            .map_err(|error| format!("No se pudo confirmar delete_leaf_node: {error}"))?;

        self.load_document_snapshot(document_id)
    }

    pub fn set_document_viewport(
        &mut self,
        document_id: i64,
        pan_x: f64,
        pan_y: f64,
        zoom: f64,
    ) -> Result<Option<OpenDocumentSnapshotDto>, String> {
        let now = now_ts();

        let updated_rows = self
            .connection
            .execute(
                r#"
                UPDATE document_view_state
                SET
                  pan_x = ?1,
                  pan_y = ?2,
                  zoom = ?3,
                  updated_at = ?4
                WHERE document_id = ?5
                "#,
                params![pan_x, pan_y, zoom, now, document_id],
            )
            .map_err(|error| format!("No se pudo actualizar el viewport del documento: {error}"))?;

        if updated_rows == 0 {
            return Ok(None);
        }

        self.open_document(document_id)
    }

    fn load_document_snapshot(
        &self,
        document_id: i64,
    ) -> Result<Option<OpenDocumentSnapshotDto>, String> {
        let document = self
            .connection
            .query_row(
                r#"
                SELECT id, title, created_at, updated_at
                FROM documents
                WHERE id = ?1
                "#,
                [document_id],
                |row| {
                    Ok(DocumentDto {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        created_at: row.get(2)?,
                        updated_at: row.get(3)?,
                    })
                },
            )
            .optional()
            .map_err(|error| format!("No se pudo leer el documento {document_id}: {error}"))?;

        let Some(document) = document else {
            return Ok(None);
        };

        let root_node_id = self
            .connection
            .query_row(
                r#"
                SELECT id
                FROM nodes
                WHERE document_id = ?1
                  AND parent_id IS NULL
                LIMIT 1
                "#,
                [document_id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| {
                format!("No se pudo leer el root del documento {document_id}: {error}")
            })?;

        let mut nodes_statement = self
            .connection
            .prepare(
                r#"
                SELECT
                  id,
                  document_id,
                  parent_id,
                  title,
                  learning_status,
                  is_collapsed,
                  sibling_order,
                  created_at,
                  updated_at
                FROM nodes
                WHERE document_id = ?1
                ORDER BY
                  CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END,
                  COALESCE(parent_id, 0),
                  sibling_order,
                  id
                "#,
            )
            .map_err(|error| format!("No se pudo preparar la lectura de nodes: {error}"))?;

        let node_rows = nodes_statement
            .query_map([document_id], |row| {
                let is_collapsed_int: i64 = row.get(5)?;

                Ok(NodeDto {
                    id: row.get(0)?,
                    document_id: row.get(1)?,
                    parent_id: row.get::<_, Option<i64>>(2)?,
                    title: row.get(3)?,
                    learning_status: row.get(4)?,
                    is_collapsed: is_collapsed_int != 0,
                    sibling_order: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })
            .map_err(|error| format!("No se pudo ejecutar la lectura de nodes: {error}"))?;

        let mut nodes = Vec::new();

        for row in node_rows {
            nodes.push(row.map_err(|error| format!("No se pudo leer un nodo: {error}"))?);
        }

        let view_state = self
            .connection
            .query_row(
                r#"
                SELECT
                  document_id,
                  selected_node_id,
                  pan_x,
                  pan_y,
                  zoom,
                  updated_at
                FROM document_view_state
                WHERE document_id = ?1
                "#,
                [document_id],
                |row| {
                    Ok(DocumentViewStateDto {
                        document_id: row.get(0)?,
                        selected_node_id: row.get::<_, Option<i64>>(1)?,
                        pan_x: row.get(2)?,
                        pan_y: row.get(3)?,
                        zoom: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                },
            )
            .map_err(|error| {
                format!("No se pudo leer document_view_state para {document_id}: {error}")
            })?;

        let selected_node_content = if let Some(selected_node_id) = view_state.selected_node_id {
            self.get_node_content_by_id(selected_node_id)?
        } else {
            None
        };

        Ok(Some(OpenDocumentSnapshotDto {
            document,
            root_node_id,
            nodes,
            view_state,
            selected_node_content,
        }))
    }

    fn get_node_content_by_id(
        &self,
        node_id: i64,
    ) -> Result<Option<SelectedNodeContentDto>, String> {
        self.connection
            .query_row(
                r#"
                SELECT
                  node_id,
                  note,
                  body,
                  created_at,
                  updated_at
                FROM node_content
                WHERE node_id = ?1
                "#,
                [node_id],
                |row| {
                    Ok(SelectedNodeContentDto {
                        node_id: row.get(0)?,
                        note: row.get::<_, Option<String>>(1)?,
                        body: row.get(2)?,
                        created_at: row.get(3)?,
                        updated_at: row.get(4)?,
                    })
                },
            )
            .optional()
            .map_err(|error| format!("No se pudo leer node_content para {node_id}: {error}"))
    }
}

fn normalize_note(note: Option<String>) -> Result<Option<String>, String> {
    let Some(note) = note else {
        return Ok(None);
    };

    let normalized = note.trim();

    if normalized.is_empty() {
        return Ok(None);
    }

    if normalized.chars().count() > 500 {
        return Err("La nota no puede superar los 500 caracteres".to_string());
    }

    Ok(Some(normalized.to_string()))
}

fn normalize_learning_status(learning_status: String) -> Result<String, String> {
    let normalized = learning_status.trim();

    match normalized {
        "sin_ver" | "visto" | "en_estudio" | "dominado" => Ok(normalized.to_string()),
        _ => Err("El estado de aprendizaje no es válido".to_string()),
    }
}

fn normalize_node_title(title: String) -> Result<String, String> {
    let normalized = title.trim();

    if normalized.is_empty() {
        return Err("El título no puede estar vacío".to_string());
    }

    Ok(normalized.to_string())
}

fn node_has_children(
    transaction: &Transaction<'_>,
    document_id: i64,
    node_id: i64,
) -> Result<bool, String> {
    let child_count = transaction
        .query_row(
            r#"
            SELECT COUNT(*)
            FROM nodes
            WHERE document_id = ?1
              AND parent_id = ?2
            "#,
            params![document_id, node_id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| {
            format!("No se pudo comprobar si el nodo {node_id} tiene hijos: {error}")
        })?;

    Ok(child_count > 0)
}

fn get_node_parent_id(
    transaction: &Transaction<'_>,
    document_id: i64,
    node_id: i64,
) -> Result<Option<i64>, String> {
    transaction
        .query_row(
            r#"
            SELECT parent_id
            FROM nodes
            WHERE id = ?1
              AND document_id = ?2
            "#,
            params![node_id, document_id],
            |row| row.get::<_, Option<i64>>(0),
        )
        .optional()
        .map_err(|error| format!("No se pudo leer el parent_id del nodo {node_id}: {error}"))?
        .ok_or_else(|| {
            format!("No se pudo resolver la jerarquía del nodo {node_id} dentro del documento {document_id}")
        })
}

fn calculate_derived_learning_status(
    transaction: &Transaction<'_>,
    document_id: i64,
    node_id: i64,
) -> Result<Option<String>, String> {
    let (
        total_children,
        sin_ver_count,
        visto_count,
        en_estudio_count,
        dominado_count,
    ) = transaction
        .query_row(
            r#"
            SELECT
              COUNT(*) AS total_children,
              COALESCE(SUM(CASE WHEN learning_status = 'sin_ver' THEN 1 ELSE 0 END), 0) AS sin_ver_count,
              COALESCE(SUM(CASE WHEN learning_status = 'visto' THEN 1 ELSE 0 END), 0) AS visto_count,
              COALESCE(SUM(CASE WHEN learning_status = 'en_estudio' THEN 1 ELSE 0 END), 0) AS en_estudio_count,
              COALESCE(SUM(CASE WHEN learning_status = 'dominado' THEN 1 ELSE 0 END), 0) AS dominado_count
            FROM nodes
            WHERE document_id = ?1
              AND parent_id = ?2
            "#,
            params![document_id, node_id],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)?,
                ))
            },
        )
        .map_err(|error| {
            format!("No se pudo calcular el estado derivado del nodo {node_id}: {error}")
        })?;

    if total_children == 0 {
        return Ok(None);
    }

    let derived_status = if dominado_count == total_children {
        "dominado"
    } else if en_estudio_count > 0 {
        "en_estudio"
    } else if sin_ver_count == 0 && (visto_count + dominado_count == total_children) {
        "visto"
    } else {
        "sin_ver"
    };

    Ok(Some(derived_status.to_string()))
}

fn recalculate_learning_status_upwards(
    transaction: &Transaction<'_>,
    document_id: i64,
    start_node_id: Option<i64>,
    now: i64,
) -> Result<(), String> {
    let mut current_node_id = start_node_id;

    while let Some(node_id) = current_node_id {
        if let Some(derived_status) =
            calculate_derived_learning_status(transaction, document_id, node_id)?
        {
            transaction
                .execute(
                    r#"
                    UPDATE nodes
                    SET
                      learning_status = ?1,
                      updated_at = ?2
                    WHERE id = ?3
                      AND document_id = ?4
                    "#,
                    params![derived_status, now, node_id, document_id],
                )
                .map_err(|error| {
                    format!("No se pudo recalcular el estado derivado del nodo {node_id}: {error}")
                })?;
        }

        current_node_id = get_node_parent_id(transaction, document_id, node_id)?;
    }

    Ok(())
}

fn get_document_selected_node_id(
    transaction: &Transaction<'_>,
    document_id: i64,
) -> Result<Option<i64>, String> {
    let selected = transaction
        .query_row(
            r#"
            SELECT selected_node_id
            FROM document_view_state
            WHERE document_id = ?1
            "#,
            [document_id],
            |row| row.get::<_, Option<i64>>(0),
        )
        .optional()
        .map_err(|error| {
            format!(
                "No se pudo leer document_view_state.selected_node_id para {document_id}: {error}"
            )
        })?;

    Ok(selected.flatten())
}

fn is_descendant_of_node(
    transaction: &Transaction<'_>,
    document_id: i64,
    ancestor_node_id: i64,
    candidate_node_id: i64,
) -> Result<bool, String> {
    if ancestor_node_id == candidate_node_id {
        return Ok(false);
    }

    let mut current_node_id = candidate_node_id;

    loop {
        let parent_id = transaction
            .query_row(
                r#"
                SELECT parent_id
                FROM nodes
                WHERE id = ?1
                  AND document_id = ?2
                "#,
                params![current_node_id, document_id],
                |row| row.get::<_, Option<i64>>(0),
            )
            .optional()
            .map_err(|error| {
                format!("No se pudo recorrer la jerarquía del nodo {candidate_node_id}: {error}")
            })?
            .ok_or_else(|| {
                format!(
                    "No se pudo resolver la jerarquía del nodo {candidate_node_id} dentro del documento {document_id}"
                )
            })?;

        let Some(parent_id) = parent_id else {
            return Ok(false);
        };

        if parent_id == ancestor_node_id {
            return Ok(true);
        }

        current_node_id = parent_id;
    }
}

fn load_copy_node_sources(
    transaction: &Transaction<'_>,
    source_document_id: i64,
) -> Result<Vec<CopyNodeSource>, String> {
    let mut statement = transaction
        .prepare(
            r#"
            SELECT
              id,
              parent_id,
              title,
              learning_status,
              is_collapsed,
              sibling_order
            FROM nodes
            WHERE document_id = ?1
            ORDER BY
              CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END,
              parent_id,
              sibling_order,
              id
            "#,
        )
        .map_err(|error| {
            format!("No se pudo preparar la lectura de nodos para copiar: {error}")
        })?;

    let rows = statement
        .query_map([source_document_id], |row| {
            Ok(CopyNodeSource {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                title: row.get(2)?,
                learning_status: row.get(3)?,
                is_collapsed: row.get(4)?,
                sibling_order: row.get(5)?,
            })
        })
        .map_err(|error| {
            format!("No se pudieron leer los nodos del documento origen {source_document_id}: {error}")
        })?;

    let mut nodes = Vec::new();

    for row in rows {
        nodes.push(
            row.map_err(|error| {
                format!("No se pudo leer un nodo del documento origen {source_document_id}: {error}")
            })?,
        );
    }

    Ok(nodes)
}

fn copy_nodes_into_document(
    transaction: &Transaction<'_>,
    copied_document_id: i64,
    source_nodes: &[CopyNodeSource],
    now: i64,
) -> Result<HashMap<i64, i64>, String> {
    let mut copied_node_ids_by_source_id = HashMap::<i64, i64>::new();
    let mut remaining_nodes = source_nodes.to_vec();

    while !remaining_nodes.is_empty() {
        let mut copied_in_current_pass = 0;
        let mut index = 0;

        while index < remaining_nodes.len() {
            let source_node = &remaining_nodes[index];

            let copied_parent_id = match source_node.parent_id {
                Some(source_parent_id) => {
                    let Some(copied_parent_id) =
                        copied_node_ids_by_source_id.get(&source_parent_id).copied()
                    else {
                        index += 1;
                        continue;
                    };

                    Some(copied_parent_id)
                }
                None => None,
            };

            let source_node = remaining_nodes.remove(index);

            transaction
                .execute(
                    r#"
                    INSERT INTO nodes (
                      document_id,
                      parent_id,
                      title,
                      learning_status,
                      is_collapsed,
                      sibling_order,
                      created_at,
                      updated_at
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                    "#,
                    params![
                        copied_document_id,
                        copied_parent_id,
                        source_node.title,
                        source_node.learning_status,
                        source_node.is_collapsed,
                        source_node.sibling_order,
                        now,
                        now,
                    ],
                )
                .map_err(|error| {
                    format!(
                        "No se pudo copiar el nodo {} al documento {}: {error}",
                        source_node.id,
                        copied_document_id,
                    )
                })?;

            let copied_node_id = transaction.last_insert_rowid();

            copied_node_ids_by_source_id.insert(
                source_node.id,
                copied_node_id,
            );

            copied_in_current_pass += 1;
        }

        if copied_in_current_pass == 0 {
            return Err(
                "No se pudo reconstruir la jerarquía del documento copiado. Hay nodos con parent_id no resoluble."
                    .to_string(),
            );
        }
    }

    Ok(copied_node_ids_by_source_id)
}

fn load_copy_node_content_sources(
    transaction: &Transaction<'_>,
    source_document_id: i64,
) -> Result<Vec<CopyNodeContentSource>, String> {
    let mut statement = transaction
        .prepare(
            r#"
            SELECT
              nodes.id,
              node_content.note,
              COALESCE(node_content.body, '')
            FROM nodes
            LEFT JOIN node_content
              ON node_content.node_id = nodes.id
            WHERE nodes.document_id = ?1
            ORDER BY nodes.id
            "#,
        )
        .map_err(|error| {
            format!("No se pudo preparar la lectura de contenidos para copiar: {error}")
        })?;

    let rows = statement
        .query_map([source_document_id], |row| {
            Ok(CopyNodeContentSource {
                node_id: row.get(0)?,
                note: row.get(1)?,
                body: row.get(2)?,
            })
        })
        .map_err(|error| {
            format!(
                "No se pudieron leer los contenidos del documento origen {source_document_id}: {error}",
            )
        })?;

    let mut contents = Vec::new();

    for row in rows {
        contents.push(
            row.map_err(|error| {
                format!(
                    "No se pudo leer un contenido del documento origen {source_document_id}: {error}",
                )
            })?,
        );
    }

    Ok(contents)
}

fn copy_node_contents_into_document(
    transaction: &Transaction<'_>,
    source_document_id: i64,
    copied_node_ids_by_source_id: &HashMap<i64, i64>,
    now: i64,
) -> Result<(), String> {
    let source_contents = load_copy_node_content_sources(
        transaction,
        source_document_id,
    )?;

    for source_content in source_contents {
        let copied_node_id = copied_node_ids_by_source_id
            .get(&source_content.node_id)
            .copied()
            .ok_or_else(|| {
                format!(
                    "No se pudo resolver el nodo copiado para el contenido del nodo origen {}",
                    source_content.node_id,
                )
            })?;

        transaction
            .execute(
                r#"
                INSERT INTO node_content (
                  node_id,
                  note,
                  body,
                  created_at,
                  updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5)
                "#,
                params![
                    copied_node_id,
                    source_content.note,
                    source_content.body,
                    now,
                    now,
                ],
            )
            .map_err(|error| {
                format!(
                    "No se pudo copiar el contenido del nodo origen {} al nodo nuevo {}: {error}",
                    source_content.node_id,
                    copied_node_id,
                )
            })?;
    }

    Ok(())
}

fn insert_document(transaction: &Transaction<'_>, title: &str, now: i64) -> Result<i64, String> {
    transaction
        .execute(
            r#"
            INSERT INTO documents (
              title,
              created_at,
              updated_at
            )
            VALUES (?1, ?2, ?3)
            "#,
            params![title, now, now],
        )
        .map_err(|error| format!("No se pudo insertar el documento: {error}"))?;

    Ok(transaction.last_insert_rowid())
}

fn insert_root_node(
    transaction: &Transaction<'_>,
    document_id: i64,
    title: &str,
    now: i64,
) -> Result<i64, String> {
    transaction
        .execute(
            r#"
            INSERT INTO nodes (
              document_id,
              parent_id,
              title,
              learning_status,
              is_collapsed,
              sibling_order,
              created_at,
              updated_at
            )
            VALUES (?1, NULL, ?2, 'sin_ver', 0, 0, ?3, ?4)
            "#,
            params![document_id, title, now, now],
        )
        .map_err(|error| format!("No se pudo insertar el root en nodes: {error}"))?;

    Ok(transaction.last_insert_rowid())
}

fn insert_child_node(
    transaction: &Transaction<'_>,
    document_id: i64,
    parent_node_id: i64,
    title: &str,
    sibling_order: i64,
    now: i64,
) -> Result<i64, String> {
    transaction
        .execute(
            r#"
            INSERT INTO nodes (
              document_id,
              parent_id,
              title,
              learning_status,
              is_collapsed,
              sibling_order,
              created_at,
              updated_at
            )
            VALUES (?1, ?2, ?3, 'sin_ver', 0, ?4, ?5, ?6)
            "#,
            params![document_id, parent_node_id, title, sibling_order, now, now],
        )
        .map_err(|error| format!("No se pudo insertar el nodo hijo: {error}"))?;

    Ok(transaction.last_insert_rowid())
}

fn insert_node_content(
    transaction: &Transaction<'_>,
    node_id: i64,
    now: i64,
) -> Result<(), String> {
    transaction
        .execute(
            r#"
            INSERT INTO node_content (
              node_id,
              note,
              body,
              created_at,
              updated_at
            )
            VALUES (?1, NULL, '', ?2, ?3)
            "#,
            params![node_id, now, now],
        )
        .map_err(|error| format!("No se pudo insertar node_content del nodo: {error}"))?;

    Ok(())
}

fn update_document_view_state_selection(
    transaction: &Transaction<'_>,
    document_id: i64,
    selected_node_id: i64,
    now: i64,
) -> Result<(), String> {
    let updated_rows = transaction
        .execute(
            r#"
            UPDATE document_view_state
            SET
              selected_node_id = ?1,
              updated_at = ?2
            WHERE document_id = ?3
            "#,
            params![selected_node_id, now, document_id],
        )
        .map_err(|error| format!("No se pudo actualizar document_view_state: {error}"))?;

    if updated_rows != 1 {
        transaction
            .execute(
                r#"
                INSERT INTO document_view_state (
                  document_id,
                  selected_node_id,
                  pan_x,
                  pan_y,
                  zoom,
                  updated_at
                )
                VALUES (?1, ?2, 0.0, 0.0, 1.0, ?3)
                "#,
                params![document_id, selected_node_id, now],
            )
            .map_err(|error| format!("No se pudo insertar document_view_state: {error}"))?;
    }

    Ok(())
}

fn update_document_updated_at(
    transaction: &Transaction<'_>,
    document_id: i64,
    now: i64,
) -> Result<(), String> {
    transaction
        .execute(
            r#"
            UPDATE documents
            SET updated_at = ?1
            WHERE id = ?2
            "#,
            params![now, document_id],
        )
        .map_err(|error| format!("No se pudo actualizar documents.updated_at: {error}"))?;

    Ok(())
}

fn update_last_opened_document_id(
    transaction: &Transaction<'_>,
    document_id: i64,
    now: i64,
) -> Result<(), String> {
    transaction
        .execute(
            r#"
            UPDATE app_settings
            SET
              last_opened_document_id = ?1,
              updated_at = ?2
            WHERE singleton_id = 1
            "#,
            params![document_id, now],
        )
        .map_err(|error| {
            format!("No se pudo actualizar app_settings.last_opened_document_id: {error}")
        })?;

    Ok(())
}

fn now_ts() -> i64 {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time before unix epoch");

    duration.as_millis() as i64
}

#[cfg(test)]
mod tests {
    use super::Database;
    use rusqlite::params;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::thread::sleep;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    fn unique_test_db_path(test_name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before unix epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("study-tree-{test_name}-{unique}.sqlite3"))
    }

    fn cleanup_sqlite_files(db_path: &Path) {
        let _ = fs::remove_file(db_path);

        if let Some(db_str) = db_path.to_str() {
            let _ = fs::remove_file(format!("{db_str}-wal"));
            let _ = fs::remove_file(format!("{db_str}-shm"));
        }
    }

    fn read_last_opened_document_id(database: &Database) -> Option<i64> {
        database
            .connection
            .query_row(
                r#"
                SELECT last_opened_document_id
                FROM app_settings
                WHERE singleton_id = 1
                "#,
                [],
                |row| row.get::<_, Option<i64>>(0),
            )
            .expect("app_settings should be readable")
    }

    #[test]
    fn pragmas_are_configured_correctly() {
        let db_path = unique_test_db_path("pragmas");
        let database = Database::open_for_test(&db_path).expect("database should open");

        let foreign_keys: i64 = database
            .connection
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .expect("foreign_keys should be readable");

        let journal_mode: String = database
            .connection
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .expect("journal_mode should be readable");

        let synchronous: i64 = database
            .connection
            .query_row("PRAGMA synchronous", [], |row| row.get(0))
            .expect("synchronous should be readable");

        assert_eq!(foreign_keys, 1);
        assert_eq!(journal_mode.to_lowercase(), "wal");
        assert_eq!(synchronous, 2);

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn create_document_persists_document_root_content_view_state_and_setting() {
        let db_path = unique_test_db_path("create");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema 01 · Organización institucional".to_string())
            .expect("create_document should succeed");

        assert!(created.document.id > 0);
        assert_eq!(
            created.document.title,
            "Tema 01 · Organización institucional"
        );
        assert_eq!(
            created.root_node_id,
            created.view_state.selected_node_id.unwrap()
        );

        assert_eq!(created.nodes.len(), 1);
        assert_eq!(created.nodes[0].id, created.root_node_id);
        assert_eq!(created.nodes[0].parent_id, None);
        assert_eq!(
            created.nodes[0].title,
            "Tema 01 · Organización institucional"
        );
        assert_eq!(created.nodes[0].learning_status, "sin_ver");
        assert!(!created.nodes[0].is_collapsed);
        assert_eq!(created.nodes[0].sibling_order, 0);

        let selected_node_content = created
            .selected_node_content
            .as_ref()
            .expect("selected node content should exist");

        assert_eq!(selected_node_content.node_id, created.root_node_id);
        assert_eq!(selected_node_content.note, None);
        assert_eq!(selected_node_content.body, "");

        let listed = database
            .list_documents()
            .expect("list_documents should succeed");

        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, created.document.id);
        assert_eq!(listed[0].title, created.document.title);

        assert_eq!(
            read_last_opened_document_id(&database),
            Some(created.document.id)
        );

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn open_document_returns_none_if_document_does_not_exist() {
        let db_path = unique_test_db_path("open-none");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let document = database
            .open_document(999_999)
            .expect("open_document should succeed");

        assert!(document.is_none());

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn open_last_opened_document_returns_none_when_setting_is_null() {
        let db_path = unique_test_db_path("open-last-none");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let document = database
            .open_last_opened_document()
            .expect("open_last_opened_document should succeed");

        assert!(document.is_none());

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn open_last_opened_document_recovers_the_last_opened_document() {
        let db_path = unique_test_db_path("open-last-existing");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let first = database
            .create_document("Documento A".to_string())
            .expect("first document should be created");

        sleep(Duration::from_millis(2));

        let _second = database
            .create_document("Documento B".to_string())
            .expect("second document should be created");

        sleep(Duration::from_millis(2));

        let reopened_first = database
            .open_document(first.document.id)
            .expect("open_document should succeed")
            .expect("document should exist");

        assert_eq!(reopened_first.document.id, first.document.id);

        let reopened_last = database
            .open_last_opened_document()
            .expect("open_last_opened_document should succeed")
            .expect("document should exist");

        assert_eq!(reopened_last.document.id, first.document.id);
        assert_eq!(
            read_last_opened_document_id(&database),
            Some(first.document.id)
        );

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn open_document_updates_last_opened_document_id() {
        let db_path = unique_test_db_path("open-updates-setting");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let first = database
            .create_document("Documento A".to_string())
            .expect("first document should be created");

        sleep(Duration::from_millis(2));

        let second = database
            .create_document("Documento B".to_string())
            .expect("second document should be created");

        assert_eq!(
            read_last_opened_document_id(&database),
            Some(second.document.id)
        );

        let reopened = database
            .open_document(first.document.id)
            .expect("open_document should succeed")
            .expect("document should exist");

        assert_eq!(reopened.document.id, first.document.id);
        assert_eq!(
            read_last_opened_document_id(&database),
            Some(first.document.id)
        );

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn document_view_state_trigger_rejects_selected_node_from_other_document() {
        let db_path = unique_test_db_path("trigger-same-document");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let first = database
            .create_document("Documento A".to_string())
            .expect("first document should be created");

        sleep(Duration::from_millis(2));

        let second = database
            .create_document("Documento B".to_string())
            .expect("second document should be created");

        let error = database
            .connection
            .execute(
                r#"
                UPDATE document_view_state
                SET selected_node_id = ?1
                WHERE document_id = ?2
                "#,
                params![second.root_node_id, first.document.id],
            )
            .expect_err("trigger should reject node from another document");

        assert!(error
            .to_string()
            .contains("selected_node_id must belong to the same document"));

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn update_node_content_persists_note_body_and_document_updated_at() {
        let db_path = unique_test_db_path("update-content");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Documento con contenido".to_string())
            .expect("document should be created");

        let previous_updated_at = created.document.updated_at;

        sleep(Duration::from_millis(2));

        let updated_content = database
            .update_node_content(
                created.root_node_id,
                Some("  Nota inicial  ".to_string()),
                "Contenido principal del nodo".to_string(),
            )
            .expect("update_node_content should succeed");

        assert_eq!(updated_content.node_id, created.root_node_id);
        assert_eq!(updated_content.note, Some("Nota inicial".to_string()));
        assert_eq!(updated_content.body, "Contenido principal del nodo");

        let reopened = database
            .open_document(created.document.id)
            .expect("open_document should succeed")
            .expect("document should exist");

        let selected_node_content = reopened
            .selected_node_content
            .as_ref()
            .expect("selected node content should exist");

        assert_eq!(selected_node_content.note, Some("Nota inicial".to_string()));
        assert_eq!(selected_node_content.body, "Contenido principal del nodo");
        assert!(reopened.document.updated_at > previous_updated_at);

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn create_child_node_persists_child_updates_selection_and_snapshot() {
        let db_path = unique_test_db_path("create-child");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        sleep(Duration::from_millis(2));

        let with_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("create_child_node should succeed");

        assert_eq!(with_child.document.id, created.document.id);
        assert_eq!(with_child.nodes.len(), 2);

        let child = with_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id))
            .expect("child node should exist");

        assert_eq!(child.title, "Epígrafe 1");
        assert_eq!(child.learning_status, "sin_ver");
        assert!(!child.is_collapsed);
        assert_eq!(child.sibling_order, 0);

        assert_eq!(with_child.view_state.selected_node_id, Some(child.id));

        let selected_node_content = with_child
            .selected_node_content
            .as_ref()
            .expect("selected child content should exist");

        assert_eq!(selected_node_content.node_id, child.id);
        assert_eq!(selected_node_content.note, None);
        assert_eq!(selected_node_content.body, "");
        assert!(with_child.document.updated_at > created.document.updated_at);

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn select_node_updates_view_state_and_selected_content() {
        let db_path = unique_test_db_path("select-node");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        sleep(Duration::from_millis(2));

        let with_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("create_child_node should succeed");

        let child = with_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id))
            .expect("child node should exist");

        let selected_root = database
            .select_node(created.document.id, created.root_node_id)
            .expect("select_node root should succeed")
            .expect("document should exist");

        assert_eq!(
            selected_root.view_state.selected_node_id,
            Some(created.root_node_id)
        );
        assert_eq!(
            selected_root
                .selected_node_content
                .as_ref()
                .expect("root content should exist")
                .node_id,
            created.root_node_id
        );

        sleep(Duration::from_millis(2));

        let selected_child = database
            .select_node(created.document.id, child.id)
            .expect("select_node child should succeed")
            .expect("document should exist");

        assert_eq!(selected_child.view_state.selected_node_id, Some(child.id));
        assert_eq!(
            selected_child
                .selected_node_content
                .as_ref()
                .expect("child content should exist")
                .node_id,
            child.id
        );

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn set_node_collapsed_persists_flag_and_recovers_after_reopen() {
        let db_path = unique_test_db_path("set-collapsed");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        sleep(Duration::from_millis(2));

        let with_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("create_child_node should succeed");

        let child = with_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id))
            .expect("child node should exist");

        let collapsed_snapshot = database
            .set_node_collapsed(created.document.id, child.id, true)
            .expect("set_node_collapsed should succeed")
            .expect("document should exist");

        let collapsed_child = collapsed_snapshot
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("collapsed child should exist");

        assert!(collapsed_child.is_collapsed);

        let reopened_collapsed = database
            .open_document(created.document.id)
            .expect("open_document should succeed")
            .expect("document should exist");

        let reopened_collapsed_child = reopened_collapsed
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("reopened child should exist");

        assert!(reopened_collapsed_child.is_collapsed);

        sleep(Duration::from_millis(2));

        let expanded_snapshot = database
            .set_node_collapsed(created.document.id, child.id, false)
            .expect("set_node_collapsed false should succeed")
            .expect("document should exist");

        let expanded_child = expanded_snapshot
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("expanded child should exist");

        assert!(!expanded_child.is_collapsed);

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn set_node_collapsed_moves_selection_to_collapsed_ancestor_when_selected_descendant_would_be_hidden(
    ) {
        let db_path = unique_test_db_path("collapse-moves-selection");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        sleep(Duration::from_millis(2));

        let with_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("child should be created");

        let child = with_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id))
            .expect("child node should exist")
            .clone();

        sleep(Duration::from_millis(2));

        let with_grandchild = database
            .create_child_node(child.id, "Subepígrafe 1.1".to_string())
            .expect("grandchild should be created");

        let grandchild = with_grandchild
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(child.id))
            .expect("grandchild node should exist")
            .clone();

        assert_eq!(
            with_grandchild.view_state.selected_node_id,
            Some(grandchild.id)
        );

        sleep(Duration::from_millis(2));

        let collapsed = database
            .set_node_collapsed(created.document.id, child.id, true)
            .expect("set_node_collapsed should succeed")
            .expect("document should exist");

        let collapsed_child = collapsed
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("collapsed child should exist");

        assert!(collapsed_child.is_collapsed);
        assert_eq!(collapsed.view_state.selected_node_id, Some(child.id));
        assert_eq!(
            collapsed
                .selected_node_content
                .as_ref()
                .expect("selected content should exist")
                .node_id,
            child.id
        );

        let reopened = database
            .open_document(created.document.id)
            .expect("open_document should succeed")
            .expect("document should exist");

        let reopened_child = reopened
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("reopened child should exist");

        assert!(reopened_child.is_collapsed);
        assert_eq!(reopened.view_state.selected_node_id, Some(child.id));
        assert_eq!(
            reopened
                .selected_node_content
                .as_ref()
                .expect("selected content after reopen should exist")
                .node_id,
            child.id
        );

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn set_node_learning_status_persists_change_and_recovers_after_reopen() {
        let db_path = unique_test_db_path("learning-status");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        sleep(Duration::from_millis(2));

        let with_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("child should be created");

        let child = with_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id))
            .expect("child node should exist")
            .clone();

        let previous_updated_at = with_child.document.updated_at;

        sleep(Duration::from_millis(2));

        let updated = database
            .set_node_learning_status(created.document.id, child.id, "dominado".to_string())
            .expect("set_node_learning_status should succeed")
            .expect("document should exist");

        let updated_child = updated
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("updated child should exist");

        assert_eq!(updated_child.learning_status, "dominado");
        assert!(updated.document.updated_at > previous_updated_at);

        let reopened = database
            .open_document(created.document.id)
            .expect("open_document should succeed")
            .expect("document should exist");

        let reopened_child = reopened
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("reopened child should exist");

        assert_eq!(reopened_child.learning_status, "dominado");

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn set_node_learning_status_rejects_invalid_value() {
        let db_path = unique_test_db_path("learning-status-invalid");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        let error = database
            .set_node_learning_status(
                created.document.id,
                created.root_node_id,
                "inventado".to_string(),
            )
            .expect_err("invalid learning status should fail");

        assert!(error.contains("estado de aprendizaje"));

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn rename_node_persists_child_title_and_recovers_after_reopen() {
        let db_path = unique_test_db_path("rename-child");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        sleep(Duration::from_millis(2));

        let with_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("child should be created");

        let child = with_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id))
            .expect("child node should exist")
            .clone();

        let previous_updated_at = with_child.document.updated_at;

        sleep(Duration::from_millis(2));

        let renamed = database
            .rename_node(
                created.document.id,
                child.id,
                "Epígrafe 1 renombrado".to_string(),
            )
            .expect("rename_node should succeed")
            .expect("document should exist");

        let renamed_child = renamed
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("renamed child should exist");

        assert_eq!(renamed_child.title, "Epígrafe 1 renombrado");
        assert_eq!(renamed.view_state.selected_node_id, Some(child.id));
        assert!(renamed.document.updated_at > previous_updated_at);

        let reopened = database
            .open_document(created.document.id)
            .expect("open_document should succeed")
            .expect("document should exist");

        let reopened_child = reopened
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("reopened child should exist");

        assert_eq!(reopened_child.title, "Epígrafe 1 renombrado");

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn rename_root_node_updates_document_title_and_list_item() {
        let db_path = unique_test_db_path("rename-root");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        sleep(Duration::from_millis(2));

        let renamed = database
            .rename_node(
                created.document.id,
                created.root_node_id,
                "Tema principal renombrado".to_string(),
            )
            .expect("rename_node root should succeed")
            .expect("document should exist");

        assert_eq!(renamed.document.title, "Tema principal renombrado");

        let renamed_root = renamed
            .nodes
            .iter()
            .find(|node| node.id == created.root_node_id)
            .expect("renamed root should exist");

        assert_eq!(renamed_root.title, "Tema principal renombrado");

        let listed = database
            .list_documents()
            .expect("list_documents should succeed");

        assert_eq!(listed[0].title, "Tema principal renombrado");

        let reopened = database
            .open_document(created.document.id)
            .expect("open_document should succeed")
            .expect("document should exist");

        assert_eq!(reopened.document.title, "Tema principal renombrado");

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn rename_node_rejects_empty_title() {
        let db_path = unique_test_db_path("rename-empty");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        let error = database
            .rename_node(created.document.id, created.root_node_id, "   ".to_string())
            .expect_err("empty title should fail");

        assert!(error.contains("título"));

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn delete_leaf_node_removes_selected_leaf_moves_selection_to_parent_and_recovers_after_reopen()
    {
        let db_path = unique_test_db_path("delete-leaf");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        sleep(Duration::from_millis(2));

        let with_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("child should be created");

        let child = with_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id))
            .expect("child node should exist")
            .clone();

        assert_eq!(with_child.view_state.selected_node_id, Some(child.id));

        sleep(Duration::from_millis(2));

        let deleted = database
            .delete_leaf_node(created.document.id, child.id)
            .expect("delete_leaf_node should succeed")
            .expect("document should exist");

        assert_eq!(deleted.nodes.len(), 1);
        assert!(deleted.nodes.iter().all(|node| node.id != child.id));
        assert_eq!(
            deleted.view_state.selected_node_id,
            Some(created.root_node_id)
        );
        assert_eq!(
            deleted
                .selected_node_content
                .as_ref()
                .expect("selected content should exist")
                .node_id,
            created.root_node_id
        );

        let reopened = database
            .open_document(created.document.id)
            .expect("open_document should succeed")
            .expect("document should exist");

        assert_eq!(reopened.nodes.len(), 1);
        assert!(reopened.nodes.iter().all(|node| node.id != child.id));
        assert_eq!(
            reopened.view_state.selected_node_id,
            Some(created.root_node_id)
        );

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn delete_leaf_node_rejects_root() {
        let db_path = unique_test_db_path("delete-root");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        let error = database
            .delete_leaf_node(created.document.id, created.root_node_id)
            .expect_err("deleting root should fail");

        assert!(error.contains("root"));

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn delete_leaf_node_rejects_non_leaf_node() {
        let db_path = unique_test_db_path("delete-non-leaf");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        sleep(Duration::from_millis(2));

        let with_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("child should be created");

        let child = with_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id))
            .expect("child node should exist")
            .clone();

        sleep(Duration::from_millis(2));

        let _with_grandchild = database
            .create_child_node(child.id, "Subepígrafe 1.1".to_string())
            .expect("grandchild should be created");

        let error = database
            .delete_leaf_node(created.document.id, child.id)
            .expect_err("deleting non-leaf should fail");

        assert!(error.contains("hoja"));

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn create_child_node_recalculates_parent_when_parent_stops_being_leaf() {
        let db_path = unique_test_db_path("create-child-recalculates-parent");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        let manually_mastered_root = database
            .set_node_learning_status(
                created.document.id,
                created.root_node_id,
                "dominado".to_string(),
            )
            .expect("manual root status should succeed while root is leaf")
            .expect("document should exist");

        let root_before_child = manually_mastered_root
            .nodes
            .iter()
            .find(|node| node.id == created.root_node_id)
            .expect("root should exist before child");

        assert_eq!(root_before_child.learning_status, "dominado");

        let with_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("create_child_node should succeed");

        let root_after_child = with_child
            .nodes
            .iter()
            .find(|node| node.id == created.root_node_id)
            .expect("root should exist after child");

        let child = with_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id))
            .expect("child should exist");

        assert_eq!(child.learning_status, "sin_ver");
        assert_eq!(root_after_child.learning_status, "sin_ver");

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn set_node_learning_status_rejects_non_leaf_node_manual_update() {
        let db_path = unique_test_db_path("learning-status-non-leaf");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        let _with_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("child should be created");

        let error = database
            .set_node_learning_status(
                created.document.id,
                created.root_node_id,
                "dominado".to_string(),
            )
            .expect_err("manual update on non-leaf should fail");

        assert!(error.contains("nodos hoja"));

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn set_node_learning_status_recalculates_ancestors_from_leaf_changes() {
        let db_path = unique_test_db_path("learning-status-cascade");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        let with_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("child should be created");

        let child = with_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id))
            .expect("child node should exist")
            .clone();

        let with_first_grandchild = database
            .create_child_node(child.id, "Subepígrafe 1.1".to_string())
            .expect("first grandchild should be created");

        let first_grandchild = with_first_grandchild
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(child.id))
            .expect("first grandchild should exist")
            .clone();

        let with_second_grandchild = database
            .create_child_node(child.id, "Subepígrafe 1.2".to_string())
            .expect("second grandchild should be created");

        let second_grandchild = with_second_grandchild
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(child.id) && node.id != first_grandchild.id)
            .expect("second grandchild should exist")
            .clone();

        let after_first_seen = database
            .set_node_learning_status(
                created.document.id,
                first_grandchild.id,
                "visto".to_string(),
            )
            .expect("first grandchild seen should succeed")
            .expect("document should exist");

        let child_after_first_seen = after_first_seen
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("child should exist after first seen");

        let root_after_first_seen = after_first_seen
            .nodes
            .iter()
            .find(|node| node.id == created.root_node_id)
            .expect("root should exist after first seen");

        assert_eq!(child_after_first_seen.learning_status, "sin_ver");
        assert_eq!(root_after_first_seen.learning_status, "sin_ver");

        let after_second_seen = database
            .set_node_learning_status(
                created.document.id,
                second_grandchild.id,
                "visto".to_string(),
            )
            .expect("second grandchild seen should succeed")
            .expect("document should exist");

        let child_after_second_seen = after_second_seen
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("child should exist after second seen");

        let root_after_second_seen = after_second_seen
            .nodes
            .iter()
            .find(|node| node.id == created.root_node_id)
            .expect("root should exist after second seen");

        assert_eq!(child_after_second_seen.learning_status, "visto");
        assert_eq!(root_after_second_seen.learning_status, "visto");

        let after_in_study = database
            .set_node_learning_status(
                created.document.id,
                first_grandchild.id,
                "en_estudio".to_string(),
            )
            .expect("first grandchild in study should succeed")
            .expect("document should exist");

        let child_after_in_study = after_in_study
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("child should exist after in study");

        let root_after_in_study = after_in_study
            .nodes
            .iter()
            .find(|node| node.id == created.root_node_id)
            .expect("root should exist after in study");

        assert_eq!(child_after_in_study.learning_status, "en_estudio");
        assert_eq!(root_after_in_study.learning_status, "en_estudio");

        let after_first_mastered = database
            .set_node_learning_status(
                created.document.id,
                first_grandchild.id,
                "dominado".to_string(),
            )
            .expect("first grandchild mastered should succeed")
            .expect("document should exist");

        let child_after_first_mastered = after_first_mastered
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("child should exist after first mastered");

        let root_after_first_mastered = after_first_mastered
            .nodes
            .iter()
            .find(|node| node.id == created.root_node_id)
            .expect("root should exist after first mastered");

        assert_eq!(child_after_first_mastered.learning_status, "visto");
        assert_eq!(root_after_first_mastered.learning_status, "visto");

        let after_second_mastered = database
            .set_node_learning_status(
                created.document.id,
                second_grandchild.id,
                "dominado".to_string(),
            )
            .expect("second grandchild mastered should succeed")
            .expect("document should exist");

        let child_after_second_mastered = after_second_mastered
            .nodes
            .iter()
            .find(|node| node.id == child.id)
            .expect("child should exist after second mastered");

        let root_after_second_mastered = after_second_mastered
            .nodes
            .iter()
            .find(|node| node.id == created.root_node_id)
            .expect("root should exist after second mastered");

        assert_eq!(child_after_second_mastered.learning_status, "dominado");
        assert_eq!(root_after_second_mastered.learning_status, "dominado");

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn delete_leaf_node_recalculates_parent_from_remaining_children() {
        let db_path = unique_test_db_path("delete-leaf-recalculates-parent");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        let with_first_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("first child should be created");

        let first_child = with_first_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id))
            .expect("first child should exist")
            .clone();

        let with_second_child = database
            .create_child_node(created.root_node_id, "Epígrafe 2".to_string())
            .expect("second child should be created");

        let second_child = with_second_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id) && node.id != first_child.id)
            .expect("second child should exist")
            .clone();

        let after_seen = database
            .set_node_learning_status(created.document.id, first_child.id, "visto".to_string())
            .expect("first child seen should succeed")
            .expect("document should exist");

        let root_before_delete = after_seen
            .nodes
            .iter()
            .find(|node| node.id == created.root_node_id)
            .expect("root should exist before delete");

        assert_eq!(root_before_delete.learning_status, "sin_ver");

        let after_delete = database
            .delete_leaf_node(created.document.id, second_child.id)
            .expect("delete_leaf_node should succeed")
            .expect("document should exist");

        let root_after_delete = after_delete
            .nodes
            .iter()
            .find(|node| node.id == created.root_node_id)
            .expect("root should exist after delete");

        assert_eq!(root_after_delete.learning_status, "visto");

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn set_node_learning_status_prioritizes_en_estudio_over_sin_ver_in_mixed_siblings() {
        let db_path = unique_test_db_path("learning-status-mixed-in-study-over-sin-ver");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        let with_first_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("first child should be created");

        let first_child = with_first_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id))
            .expect("first child should exist")
            .clone();

        let with_second_child = database
            .create_child_node(created.root_node_id, "Epígrafe 2".to_string())
            .expect("second child should be created");

        let _second_child = with_second_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id) && node.id != first_child.id)
            .expect("second child should exist")
            .clone();

        let updated = database
            .set_node_learning_status(
                created.document.id,
                first_child.id,
                "en_estudio".to_string(),
            )
            .expect("setting first child to en_estudio should succeed")
            .expect("document should exist");

        let root = updated
            .nodes
            .iter()
            .find(|node| node.id == created.root_node_id)
            .expect("root should exist");

        assert_eq!(root.learning_status, "en_estudio");

        cleanup_sqlite_files(&db_path);
    }

    #[test]
    fn set_node_learning_status_keeps_sin_ver_for_mixed_visto_and_sin_ver_siblings() {
        let db_path = unique_test_db_path("learning-status-mixed-visto-and-sin-ver");
        let mut database = Database::open_for_test(&db_path).expect("database should open");

        let created = database
            .create_document("Tema principal".to_string())
            .expect("document should be created");

        let with_first_child = database
            .create_child_node(created.root_node_id, "Epígrafe 1".to_string())
            .expect("first child should be created");

        let first_child = with_first_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id))
            .expect("first child should exist")
            .clone();

        let with_second_child = database
            .create_child_node(created.root_node_id, "Epígrafe 2".to_string())
            .expect("second child should be created");

        let _second_child = with_second_child
            .nodes
            .iter()
            .find(|node| node.parent_id == Some(created.root_node_id) && node.id != first_child.id)
            .expect("second child should exist")
            .clone();

        let updated = database
            .set_node_learning_status(created.document.id, first_child.id, "visto".to_string())
            .expect("setting first child to visto should succeed")
            .expect("document should exist");

        let root = updated
            .nodes
            .iter()
            .find(|node| node.id == created.root_node_id)
            .expect("root should exist");

        assert_eq!(root.learning_status, "sin_ver");

        cleanup_sqlite_files(&db_path);
    }
}
