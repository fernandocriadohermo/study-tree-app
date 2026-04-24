import type { OpenDocumentSnapshotDto } from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

interface RenameNodeInput {
    documentId: number;
    nodeId: number;
    title: string;
}

export function renameNode(
    documentId: number,
    nodeId: number,
    title: string,
): Promise<OpenDocumentSnapshotDto | null> {
    return tauriInvoke<OpenDocumentSnapshotDto | null>('rename_node', {
        input: {
            documentId,
            nodeId,
            title,
        } satisfies RenameNodeInput,
    });
}