import type { NodeDto, OpenDocumentSnapshotDto } from '../../shared/documents/contracts';

export interface RootNodeViewModel {
    id: number;
    documentId: number;
    title: string;
    learningStatus: NodeDto['learningStatus'];
    isCollapsed: boolean;
    siblingOrder: number;
    createdAt: number;
    updatedAt: number;
}

export interface RootTreeViewModel {
    documentId: number;
    documentTitle: string;
    rootNodeId: number;
    rootNode: RootNodeViewModel;
    selectedNodeId: number | null;
}

export function getRootTreeViewModel(
    snapshot: OpenDocumentSnapshotDto,
): RootTreeViewModel {
    const rootNode = snapshot.nodes.find((node) => node.id === snapshot.rootNodeId);

    if (!rootNode) {
        throw new Error('El snapshot no contiene el nodo root esperado.');
    }

    return {
        documentId: snapshot.document.id,
        documentTitle: snapshot.document.title,
        rootNodeId: snapshot.rootNodeId,
        rootNode: {
            id: rootNode.id,
            documentId: rootNode.documentId,
            title: rootNode.title,
            learningStatus: rootNode.learningStatus,
            isCollapsed: rootNode.isCollapsed,
            siblingOrder: rootNode.siblingOrder,
            createdAt: rootNode.createdAt,
            updatedAt: rootNode.updatedAt,
        },
        selectedNodeId: snapshot.viewState.selectedNodeId,
    };
}