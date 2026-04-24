import type { OpenDocumentSnapshotDto } from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

export function openDocument(
    documentId: number,
): Promise<OpenDocumentSnapshotDto | null> {
    return tauriInvoke<OpenDocumentSnapshotDto | null>('open_document', {
        documentId,
    });
}