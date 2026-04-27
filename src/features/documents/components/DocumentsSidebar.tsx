import { useState, type FormEvent } from 'react';
import type { DocumentListItem } from '../../../shared/documents/contracts';

interface DocumentsSidebarProps {
    documents: DocumentListItem[];
    activeDocumentId: number | null;
    status: 'idle' | 'loading' | 'ready' | 'error';
    errorMessage: string | null;
    isCreating: boolean;
    isOpeningDocumentId: number | null;
    isDeletingDocumentId: number | null;
    isCopyingDocumentId: number | null;
    isImportingDocuments: boolean;
    importDocumentsErrorMessage: string | null;
    isExportingDocument: boolean;
    exportDocumentErrorMessage: string | null;
    onImportDocuments: () => Promise<void> | void;
    onExportOpenedDocument: () => Promise<void> | void;
    onRetry: () => void;
    onCreateDocument: (title: string) => Promise<void> | void;
    onOpenDocument: (documentId: number) => Promise<void> | void;
    onDeleteDocument: (documentId: number) => Promise<void> | void;
    onCopyDocument: (documentId: number) => Promise<void> | void;
}

function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString('es-ES', {
        hour12: false,
    });
}

function ImportDocumentIcon() {
    return (
        <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="documents-transfer-actions__icon"
        >
            <path
                d="M8 1.75a.75.75 0 0 1 .75.75v6.19l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06l1.72 1.72V2.5A.75.75 0 0 1 8 1.75Z"
                fill="currentColor"
            />
            <path
                d="M3.25 11.5a.75.75 0 0 1 .75.75v.5h8v-.5a.75.75 0 0 1 1.5 0v1.25a.75.75 0 0 1-.75.75h-9.5a.75.75 0 0 1-.75-.75v-1.25a.75.75 0 0 1 .75-.75Z"
                fill="currentColor"
            />
        </svg>
    );
}

function ExportDocumentIcon() {
    return (
        <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="documents-transfer-actions__icon"
        >
            <path
                d="M8 14.25a.75.75 0 0 1-.75-.75V7.31L5.53 9.03a.75.75 0 0 1-1.06-1.06l3-3a.75.75 0 0 1 1.06 0l3 3a.75.75 0 1 1-1.06 1.06L8.75 7.31v6.19a.75.75 0 0 1-.75.75Z"
                fill="currentColor"
            />
            <path
                d="M3.25 1.75h9.5a.75.75 0 0 1 .75.75v1.25a.75.75 0 0 1-1.5 0v-.5H4v.5a.75.75 0 0 1-1.5 0V2.5a.75.75 0 0 1 .75-.75Z"
                fill="currentColor"
            />
        </svg>
    );
}

export function DocumentsSidebar({
    documents,
    activeDocumentId,
    status,
    errorMessage,
    isCreating,
    isOpeningDocumentId,
    isDeletingDocumentId,
    isCopyingDocumentId,
    isImportingDocuments,
    importDocumentsErrorMessage,
    isExportingDocument,
    exportDocumentErrorMessage,
    onImportDocuments,
    onExportOpenedDocument,
    onRetry,
    onCreateDocument,
    onOpenDocument,
    onDeleteDocument,
    onCopyDocument,
}: DocumentsSidebarProps) {
    const [draftTitle, setDraftTitle] = useState('');

    const transferErrorMessage =
        importDocumentsErrorMessage ?? exportDocumentErrorMessage;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const normalizedTitle = draftTitle.trim();

        if (!normalizedTitle) {
            return;
        }

        await onCreateDocument(normalizedTitle);
        setDraftTitle('');
    };

    const handleDeleteDocument = async (
        documentId: number,
        documentTitle: string,
    ) => {
        const confirmed = window.confirm(
            `¿Borrar definitivamente el documento "${documentTitle}"?\n\nEsta acción eliminará todos sus nodos y contenidos. No se puede deshacer.`,
        );

        if (!confirmed) {
            return;
        }

        await onDeleteDocument(documentId);
    };

    const handleCopyDocument = async (documentId: number) => {
        await onCopyDocument(documentId);
    };

    return (
        <aside className="documents-sidebar">
            <div className="documents-sidebar__header">
                <div className="documents-sidebar__eyebrow">P1 · documentos</div>
                <h1 className="documents-sidebar__title">Biblioteca local</h1>
            </div>

            <form className="documents-create-form" onSubmit={handleSubmit}>
                <label className="documents-create-form__label" htmlFor="document-title">
                    Nuevo documento
                </label>

                <input
                    id="document-title"
                    className="documents-create-form__input"
                    type="text"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder="Ej. Tema 01 · Organización institucional"
                    disabled={isCreating}
                />

                <button
                    type="submit"
                    className="documents-create-form__button"
                    disabled={isCreating || draftTitle.trim().length === 0}
                >
                    {isCreating ? 'Creando…' : 'Crear documento'}
                </button>
            </form>

            <div className="documents-transfer-panel">
                <div
                    className="documents-transfer-actions"
                    aria-label="Importar o exportar documentos"
                >
                    <button
                        type="button"
                        className="documents-transfer-actions__button"
                        onClick={() => void onImportDocuments()}
                        disabled={isCreating || isImportingDocuments || isExportingDocument}
                        title="Importar documento"
                        aria-label="Importar documento"
                    >
                        <ImportDocumentIcon />
                    </button>

                    <button
                        type="button"
                        className="documents-transfer-actions__button"
                        onClick={() => void onExportOpenedDocument()}
                        disabled={
                            activeDocumentId === null ||
                            isCreating ||
                            isImportingDocuments ||
                            isExportingDocument
                        }
                        title={
                            activeDocumentId === null
                                ? 'Abre un documento para exportarlo'
                                : 'Exportar documento'
                        }
                        aria-label="Exportar documento"
                    >
                        <ExportDocumentIcon />
                    </button>
                </div>

                {transferErrorMessage ? (
                    <div className="documents-transfer-actions__error">
                        {transferErrorMessage}
                    </div>
                ) : null}
            </div>

            {status === 'loading' ? (
                <div className="documents-sidebar__status">Cargando documentos…</div>
            ) : null}

            {status === 'error' ? (
                <div className="documents-sidebar__status documents-sidebar__status--error">
                    <p className="documents-sidebar__error-title">Error de carga</p>
                    {errorMessage ? <p>{errorMessage}</p> : null}
                    <button
                        type="button"
                        className="documents-sidebar__retry"
                        onClick={onRetry}
                    >
                        Reintentar
                    </button>
                </div>
            ) : null}

            <div className="documents-sidebar__list-wrap">
                <div className="documents-sidebar__section-title">Documentos</div>

                {documents.length === 0 && status === 'ready' ? (
                    <div className="documents-sidebar__empty">
                        Aún no hay documentos. Crea el primero para abrir su root.
                    </div>
                ) : null}

                <ul className="documents-list" aria-label="Lista de documentos">
                    {documents.map((document) => {
                        const isActive = activeDocumentId === document.id;
                        const isOpening = isOpeningDocumentId === document.id;
                        const isDeleting = isDeletingDocumentId === document.id;
                        const isCopying = isCopyingDocumentId === document.id;
                        const isAnyDocumentDeleting = isDeletingDocumentId !== null;
                        const isAnyDocumentCopying = isCopyingDocumentId !== null;
                        const isDocumentActionBusy =
                            isAnyDocumentDeleting || isAnyDocumentCopying;

                        return (
                            <li key={document.id} className="documents-list__item">
                                <div className="documents-list__row">
                                    <button
                                        type="button"
                                        className={`documents-list__button${isActive ? ' is-active' : ''}`}
                                        onClick={() => onOpenDocument(document.id)}
                                        disabled={isOpening || isDocumentActionBusy}
                                    >
                                        <span className="documents-list__title">{document.title}</span>
                                        <span className="documents-list__meta">
                                            #{document.id} · {formatTimestamp(document.updatedAt)}
                                        </span>
                                        {isOpening ? (
                                            <span className="documents-list__state">Abriendo…</span>
                                        ) : null}
                                        {isDeleting ? (
                                            <span className="documents-list__state">Borrando…</span>
                                        ) : null}
                                        {isCopying ? (
                                            <span className="documents-list__state">Copiando…</span>
                                        ) : null}
                                    </button>

                                    <button
                                        type="button"
                                        className="documents-list__copy-button"
                                        onClick={() => void handleCopyDocument(document.id)}
                                        disabled={isOpening || isDocumentActionBusy}
                                        aria-label={`Copiar ${document.title}`}
                                        title="Copiar documento"
                                    >
                                        ⧉
                                    </button>

                                    <button
                                        type="button"
                                        className="documents-list__delete-button"
                                        onClick={() => void handleDeleteDocument(document.id, document.title)}
                                        disabled={isOpening || isDocumentActionBusy}
                                        aria-label={`Borrar ${document.title}`}
                                        title="Borrar documento"
                                    >
                                        ×
                                    </button>

                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </aside>
    );
}