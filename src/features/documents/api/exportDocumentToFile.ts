import { tauriInvoke } from '../../../shared/tauri/invoke';

interface ExportDocumentToFileInput {
    documentId: number;
    filePath: string;
}

export function exportDocumentToFile(
    documentId: number,
    filePath: string,
): Promise<void> {
    return tauriInvoke<void>('export_document_to_file', {
        input: {
            documentId,
            filePath,
        } satisfies ExportDocumentToFileInput,
    });
}