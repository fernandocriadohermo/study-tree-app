import type { DocumentListItem } from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

export function listDocuments(): Promise<DocumentListItem[]> {
    return tauriInvoke<DocumentListItem[]>('list_documents');
}