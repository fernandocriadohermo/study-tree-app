import type {
    NodeDto,
    OpenDocumentSnapshotDto,
} from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

interface SetNodeLearningStatusInput {
    documentId: number;
    nodeId: number;
    learningStatus: NodeDto['learningStatus'];
}

export function setNodeLearningStatus(
    documentId: number,
    nodeId: number,
    learningStatus: NodeDto['learningStatus'],
): Promise<OpenDocumentSnapshotDto | null> {
    return tauriInvoke<OpenDocumentSnapshotDto | null>('set_node_learning_status', {
        input: {
            documentId,
            nodeId,
            learningStatus,
        } satisfies SetNodeLearningStatusInput,
    });
}