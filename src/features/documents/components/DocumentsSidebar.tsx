import { useState } from 'react';
import type { DocumentListItem } from '../../../shared/documents/contracts';

interface DocumentsSidebarProps {
    documents: DocumentListItem[];
    activeDocumentId: number | null;
    status: 'idle' | 'loading' | 'ready' | 'error';
    errorMessage: string | null;
    isCreating: boolean;
    isOpeningDocumentId: number | null;
    onRetry: () => void;
    onCreateDocument: (title: string) => Promise<void> | void;
    onOpenDocument: (documentId: number) => Promise<void> | void;
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
    onRetry,
    onCreateDocument,
    onOpenDocument,
}: DocumentsSidebarProps) {
    const [draftTitle, setDraftTitle] = useState('');

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const normalizedTitle = draftTitle.trim();

        if (!normalizedTitle) {
            return;
        }

        await onCreateDocument(normalizedTitle);
        setDraftTitle('');
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

                        return (
                            <li key={document.id} className="documents-list__item">
                                <button
                                    type="button"
                                    className={`documents-list__button${isActive ? ' is-active' : ''}`}
                                    onClick={() => onOpenDocument(document.id)}
                                    disabled={isOpening}
                                >
                                    <span className="documents-list__title">{document.title}</span>
                                    <span className="documents-list__meta">
                                        #{document.id} · {formatTimestamp(document.updatedAt)}
                                    </span>
                                    {isOpening ? (
                                        <span className="documents-list__state">Abriendo…</span>
                                    ) : null}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </aside>
    );
}