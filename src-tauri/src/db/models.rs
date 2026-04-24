use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentListItemDto {
    pub id: i64,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentDto {
    pub id: i64,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeDto {
    pub id: i64,
    pub document_id: i64,
    pub parent_id: Option<i64>,
    pub title: String,
    pub learning_status: String,
    pub is_collapsed: bool,
    pub sibling_order: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentViewStateDto {
    pub document_id: i64,
    pub selected_node_id: Option<i64>,
    pub pan_x: f64,
    pub pan_y: f64,
    pub zoom: f64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedNodeContentDto {
    pub node_id: i64,
    pub note: Option<String>,
    pub body: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenDocumentSnapshotDto {
    pub document: DocumentDto,
    pub root_node_id: i64,
    pub nodes: Vec<NodeDto>,
    pub view_state: DocumentViewStateDto,
    pub selected_node_content: Option<SelectedNodeContentDto>,
}
