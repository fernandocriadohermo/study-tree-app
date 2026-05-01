export interface DocumentListItem {
    id: number;
    title: string;
    createdAt: number;
    updatedAt: number;
}

export interface DocumentDto {
    id: number;
    title: string;
    createdAt: number;
    updatedAt: number;
}

export interface NodeDto {
    id: number;
    documentId: number;
    parentId: number | null;
    title: string;
    learningStatus: 'sin_ver' | 'visto' | 'en_estudio' | 'dominado';
    isCollapsed: boolean;
    siblingOrder: number;
    createdAt: number;
    updatedAt: number;
}

export interface DocumentViewStateDto {
    documentId: number;
    selectedNodeId: number | null;
    panX: number;
    panY: number;
    zoom: number;
    updatedAt: number;
}

export interface SelectedNodeContentDto {
    nodeId: number;
    note: string | null;
    body: string;
    createdAt: number;
    updatedAt: number;
}

export interface NodeSearchContentDto {
    nodeId: number;
    note: string | null;
    body: string;
}

export interface OpenDocumentSnapshotDto {
    document: DocumentDto;
    rootNodeId: number;
    nodes: NodeDto[];
    nodeContents: NodeSearchContentDto[];
    viewState: DocumentViewStateDto;
    selectedNodeContent: SelectedNodeContentDto | null;
}

export interface SetDocumentViewportInputDto {
    documentId: number;
    panX: number;
    panY: number;
    zoom: number;
}

export interface ImportDocumentsFromFileResultDto {
    importedDocumentIds: number[];
    openedSnapshot: OpenDocumentSnapshotDto | null;
}
