import type { SelectedNodeContentDto } from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

interface UpdateNodeContentInput {
    nodeId: number;
    note: string | null;
    body: string;
}

export function updateNodeContent(
    nodeId: number,
    note: string | null,
    body: string,
): Promise<SelectedNodeContentDto> {
    return tauriInvoke<SelectedNodeContentDto>('update_node_content', {
        input: {
            nodeId,
            note,
            body,
        } satisfies UpdateNodeContentInput,
    });
}