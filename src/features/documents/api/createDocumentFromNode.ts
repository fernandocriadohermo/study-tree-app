import type { OpenDocumentSnapshotDto } from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

interface CreateDocumentFromNodeInput {
    sourceDocumentId: number;
    sourceNodeId: number;
}

export function createDocumentFromNode(
    sourceDocumentId: number,
    sourceNodeId: number,
): Promise<OpenDocumentSnapshotDto | null> {
    return tauriInvoke<OpenDocumentSnapshotDto | null>('create_document_from_node', {
        input: {
            sourceDocumentId,
            sourceNodeId,
        } satisfies CreateDocumentFromNodeInput,
    });
}