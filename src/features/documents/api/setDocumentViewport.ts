import type {
    OpenDocumentSnapshotDto,
    SetDocumentViewportInputDto,
} from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

export function setDocumentViewport(
    input: SetDocumentViewportInputDto,
): Promise<OpenDocumentSnapshotDto> {
    return tauriInvoke<OpenDocumentSnapshotDto>('set_document_viewport', {
        input,
    });
}
