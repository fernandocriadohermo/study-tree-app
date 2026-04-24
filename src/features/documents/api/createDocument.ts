import type { OpenDocumentSnapshotDto } from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

interface CreateDocumentInput {
    title: string;
}

export function createDocument(title: string): Promise<OpenDocumentSnapshotDto> {
    return tauriInvoke<OpenDocumentSnapshotDto>('create_document', {
        input: {
            title,
        } satisfies CreateDocumentInput,
    });
}