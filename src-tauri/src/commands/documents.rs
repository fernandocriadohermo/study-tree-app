use serde::Deserialize;
use tauri::State;

use crate::db::models::{DocumentListItemDto, OpenDocumentSnapshotDto, SelectedNodeContentDto};
use crate::db::DatabaseState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocumentInput {
    pub title: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNodeContentInput {
    pub node_id: i64,
    pub note: Option<String>,
    pub body: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDocumentInput {
    pub document_id: i64,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyDocumentInput {
    pub source_document_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChildNodeInput {
    pub parent_node_id: i64,
    pub title: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectNodeInput {
    pub document_id: i64,
    pub node_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetDocumentViewportInputDto {
    pub document_id: i64,
    pub pan_x: f64,
    pub pan_y: f64,
    pub zoom: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetNodeCollapsedInput {
    pub document_id: i64,
    pub node_id: i64,
    pub is_collapsed: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetNodeLearningStatusInput {
    pub document_id: i64,
    pub node_id: i64,
    pub learning_status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameNodeInput {
    pub document_id: i64,
    pub node_id: i64,
    pub title: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteLeafNodeInput {
    pub document_id: i64,
    pub node_id: i64,
}

#[tauri::command]
pub fn list_documents(state: State<'_, DatabaseState>) -> Result<Vec<DocumentListItemDto>, String> {
    let db = state
        .db
        .lock()
        .map_err(|_| "No se pudo bloquear la base de datos".to_string())?;

    db.list_documents()
}

#[tauri::command]
pub fn set_document_viewport(
    input: SetDocumentViewportInputDto,
    state: State<'_, DatabaseState>,
) -> Result<OpenDocumentSnapshotDto, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|_| "No se pudo bloquear la base de datos".to_string())?;

    let snapshot = db
        .set_document_viewport(input.document_id, input.pan_x, input.pan_y, input.zoom)?
        .ok_or_else(|| "No se pudo guardar el viewport del documento.".to_string())?;

    Ok(snapshot)
}

#[tauri::command]
pub fn create_document(
    input: CreateDocumentInput,
    state: State<'_, DatabaseState>,
) -> Result<OpenDocumentSnapshotDto, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|_| "No se pudo bloquear la base de datos".to_string())?;

    db.create_document(input.title)
}

#[tauri::command]
pub fn open_document(
    document_id: i64,
    state: State<'_, DatabaseState>,
) -> Result<Option<OpenDocumentSnapshotDto>, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|_| "No se pudo bloquear la base de datos".to_string())?;

    db.open_document(document_id)
}

#[tauri::command]
pub fn delete_document(
    input: DeleteDocumentInput,
    state: State<'_, DatabaseState>,
) -> Result<Option<OpenDocumentSnapshotDto>, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|error| format!("No se pudo bloquear la base de datos: {error}"))?;

    db.delete_document(input.document_id)
}

#[tauri::command]
pub fn copy_document(
    input: CopyDocumentInput,
    state: State<'_, DatabaseState>,
) -> Result<Option<OpenDocumentSnapshotDto>, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|error| format!("No se pudo bloquear la base de datos: {error}"))?;

    db.copy_document(input.source_document_id)
}

#[tauri::command]
pub fn open_last_opened_document(
    state: State<'_, DatabaseState>,
) -> Result<Option<OpenDocumentSnapshotDto>, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|_| "No se pudo bloquear la base de datos".to_string())?;

    db.open_last_opened_document()
}

#[tauri::command]
pub fn update_node_content(
    input: UpdateNodeContentInput,
    state: State<'_, DatabaseState>,
) -> Result<SelectedNodeContentDto, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|_| "No se pudo bloquear la base de datos".to_string())?;

    db.update_node_content(input.node_id, input.note, input.body)
}

#[tauri::command]
pub fn create_child_node(
    input: CreateChildNodeInput,
    state: State<'_, DatabaseState>,
) -> Result<OpenDocumentSnapshotDto, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|_| "No se pudo bloquear la base de datos".to_string())?;

    db.create_child_node(input.parent_node_id, input.title)
}

#[tauri::command]
pub fn select_node(
    input: SelectNodeInput,
    state: State<'_, DatabaseState>,
) -> Result<Option<OpenDocumentSnapshotDto>, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|_| "No se pudo bloquear la base de datos".to_string())?;

    db.select_node(input.document_id, input.node_id)
}

#[tauri::command]
pub fn set_node_collapsed(
    input: SetNodeCollapsedInput,
    state: State<'_, DatabaseState>,
) -> Result<Option<OpenDocumentSnapshotDto>, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|_| "No se pudo bloquear la base de datos".to_string())?;

    db.set_node_collapsed(input.document_id, input.node_id, input.is_collapsed)
}

#[tauri::command]
pub fn set_node_learning_status(
    input: SetNodeLearningStatusInput,
    state: State<'_, DatabaseState>,
) -> Result<Option<OpenDocumentSnapshotDto>, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|_| "No se pudo bloquear la base de datos".to_string())?;

    db.set_node_learning_status(input.document_id, input.node_id, input.learning_status)
}

#[tauri::command]
pub fn rename_node(
    input: RenameNodeInput,
    state: State<'_, DatabaseState>,
) -> Result<Option<OpenDocumentSnapshotDto>, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|_| "No se pudo bloquear la base de datos".to_string())?;

    db.rename_node(input.document_id, input.node_id, input.title)
}

#[tauri::command]
pub fn delete_leaf_node(
    input: DeleteLeafNodeInput,
    state: State<'_, DatabaseState>,
) -> Result<Option<OpenDocumentSnapshotDto>, String> {
    let mut db = state
        .db
        .lock()
        .map_err(|_| "No se pudo bloquear la base de datos".to_string())?;

    db.delete_leaf_node(input.document_id, input.node_id)
}
