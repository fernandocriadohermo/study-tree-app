import type { ImportDocumentsFromFileResultDto } from '../../../shared/documents/contracts';
import { tauriInvoke } from '../../../shared/tauri/invoke';

interface ImportDocumentsFromFileInput {
    filePath: string;
}

export function importDocumentsFromFile(
    filePath: string,
): Promise<ImportDocumentsFromFileResultDto> {
    return tauriInvoke<ImportDocumentsFromFileResultDto>(
        'import_documents_from_file',
        {
            input: {
                filePath,
            } satisfies ImportDocumentsFromFileInput,
        },
    );
}