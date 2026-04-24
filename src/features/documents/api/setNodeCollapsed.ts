import type { OpenDocumentSnapshotDto } from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

interface SetNodeCollapsedInput {
    documentId: number;
    nodeId: number;
    isCollapsed: boolean;
}

export function setNodeCollapsed(
    documentId: number,
    nodeId: number,
    isCollapsed: boolean,
): Promise<OpenDocumentSnapshotDto | null> {
    return tauriInvoke<OpenDocumentSnapshotDto | null>('set_node_collapsed', {
        input: {
            documentId,
            nodeId,
            isCollapsed,
        } satisfies SetNodeCollapsedInput,
    });
}