import { tauriInvoke } from '../../../shared/tauri/invoke';

interface ExportDocumentToFileInput {
    documentId: number;
    filePath: string;
}

interface ExportDocumentsToFileInput {
    documentIds: number[];
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

export function exportDocumentsToFile(
    documentIds: number[],
    filePath: string,
): Promise<void> {
    return tauriInvoke<void>('export_documents_to_file', {
        input: {
            documentIds,
            filePath,
        } satisfies ExportDocumentsToFileInput,
    });
}