import type { OpenDocumentSnapshotDto } from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

interface SelectNodeInput {
    documentId: number;
    nodeId: number;
}

export function selectNode(
    documentId: number,
    nodeId: number,
): Promise<OpenDocumentSnapshotDto | null> {
    return tauriInvoke<OpenDocumentSnapshotDto | null>('select_node', {
        input: {
            documentId,
            nodeId,
        } satisfies SelectNodeInput,
    });
}