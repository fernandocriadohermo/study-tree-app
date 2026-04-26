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

export function DocumentsSidebar({
    documents,
    activeDocumentId,
    status,
    errorMessage,
    isCreating,
    isOpeningDocumentId,
    isDeletingDocumentId,
    isCopyingDocumentId,
    onRetry,
    onCreateDocument,
    onOpenDocument,
    onDeleteDocument,
    onCopyDocument,
}: DocumentsSidebarProps) {
    const [draftTitle, setDraftTitle] = useState('');

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