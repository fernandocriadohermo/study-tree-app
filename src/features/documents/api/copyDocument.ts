import type { OpenDocumentSnapshotDto } from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

interface CopyDocumentInput {
    sourceDocumentId: number;
}

export function copyDocument(
    sourceDocumentId: number,
): Promise<OpenDocumentSnapshotDto | null> {
    return tauriInvoke<OpenDocumentSnapshotDto | null>('copy_document', {
        input: {
            sourceDocumentId,
        } satisfies CopyDocumentInput,
    });
}