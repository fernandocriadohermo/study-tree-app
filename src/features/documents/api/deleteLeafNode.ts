import type { OpenDocumentSnapshotDto } from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

interface DeleteLeafNodeInput {
    documentId: number;
    nodeId: number;
}

export function deleteLeafNode(
    documentId: number,
    nodeId: number,
): Promise<OpenDocumentSnapshotDto | null> {
    return tauriInvoke<OpenDocumentSnapshotDto | null>('delete_leaf_node', {
        input: {
            documentId,
            nodeId,
        } satisfies DeleteLeafNodeInput,
    });
}