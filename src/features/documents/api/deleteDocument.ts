import type { OpenDocumentSnapshotDto } from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

interface DeleteDocumentInput {
    documentId: number;
}

export function deleteDocument(
    documentId: number,
): Promise<OpenDocumentSnapshotDto | null> {
    return tauriInvoke<OpenDocumentSnapshotDto | null>('delete_document', {
        input: {
            documentId,
        } satisfies DeleteDocumentInput,
    });
}