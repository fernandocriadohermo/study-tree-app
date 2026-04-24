import type { OpenDocumentSnapshotDto } from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

interface CreateChildNodeInput {
    parentNodeId: number;
    title: string;
}

export function createChildNode(
    parentNodeId: number,
    title: string,
): Promise<OpenDocumentSnapshotDto> {
    return tauriInvoke<OpenDocumentSnapshotDto>('create_child_node', {
        input: {
            parentNodeId,
            title,
        } satisfies CreateChildNodeInput,
    });
}