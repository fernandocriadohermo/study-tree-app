import { useRef, useState, type FormEvent } from 'react';
import type { DocumentListItem } from '../../../shared/documents/contracts';

interface DocumentsSidebarProps {
    documents: DocumentListItem[];
    activeDocumentId: number | null;
    isCollapsed: boolean;
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
    onExportDocuments: (documentIds: number[]) => Promise<void> | void;
    onRetry: () => void;
    onCreateDocument: (title: string) => Promise<void> | void;
    onOpenDocument: (documentId: number) => Promise<void> | void;
    onDeleteDocument: (documentId: number) => Promise<void> | void;
    onCopyDocument: (documentId: number) => Promise<void> | void;
    onCollapsedChange: (isCollapsed: boolean) => void;
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

function LibraryIcon() {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="documents-rail__icon">
            <path
                d="M2.5 2.25A1.25 1.25 0 0 1 3.75 1h8.5a1.25 1.25 0 0 1 1.25 1.25v11.5A1.25 1.25 0 0 1 12.25 15h-8.5a1.25 1.25 0 0 1-1.25-1.25V2.25Zm1.5.25v11h8v-11H4Z"
                fill="currentColor"
            />
            <path
                d="M5.25 4.25h5.5v1.5h-5.5v-1.5Zm0 3h5.5v1.5h-5.5v-1.5Zm0 3h3.5v1.5h-3.5v-1.5Z"
                fill="currentColor"
            />
        </svg>
    );
}

function PlusIcon() {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="documents-rail__icon">
            <path d="M7.25 2h1.5v5.25H14v1.5H8.75V14h-1.5V8.75H2v-1.5h5.25V2Z" fill="currentColor" />
        </svg>
    );
}

function CollapseSidebarIcon() {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="documents-sidebar__collapse-icon">
            <path
                d="M2.5 2.25A1.25 1.25 0 0 1 3.75 1h8.5a1.25 1.25 0 0 1 1.25 1.25v11.5A1.25 1.25 0 0 1 12.25 15h-8.5a1.25 1.25 0 0 1-1.25-1.25V2.25Zm1.5.25v11h2.75v-11H4Zm4.25 0v11H12v-11H8.25Z"
                fill="currentColor"
            />
        </svg>
    );
}

export function DocumentsSidebar({
    documents,
    activeDocumentId,
    isCollapsed,
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
    onRetry,
    onExportDocuments,
    onCreateDocument,
    onOpenDocument,
    onDeleteDocument,
    onCopyDocument,
    onCollapsedChange,
}: DocumentsSidebarProps) {
    const [draftTitle, setDraftTitle] = useState('');
    const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
    const [selectedExportDocumentIds, setSelectedExportDocumentIds] = useState<number[]>([]);
    const titleInputRef = useRef<HTMLInputElement | null>(null);

    const transferErrorMessage =
        importDocumentsErrorMessage ?? exportDocumentErrorMessage;

    const selectedExportDocumentIdSet = new Set(selectedExportDocumentIds);
    const hasExportSelection = selectedExportDocumentIds.length > 0;
    const canOpenExportPanel =
        documents.length > 0 && !isCreating && !isImportingDocuments && !isExportingDocument;

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

    const handleOpenExportPanel = () => {
        if (!canOpenExportPanel) {
            return;
        }

        setSelectedExportDocumentIds(activeDocumentId !== null ? [activeDocumentId] : []);
        setIsExportPanelOpen(true);
    };

    const expandSidebar = () => {
        onCollapsedChange(false);
    };

    const handleExpandForCreate = () => {
        expandSidebar();
        window.requestAnimationFrame(() => titleInputRef.current?.focus());
    };

    const handleCollapsedExport = () => {
        expandSidebar();
        handleOpenExportPanel();
    };

    const handleToggleExportDocument = (documentId: number) => {
        setSelectedExportDocumentIds((current) => {
            if (current.includes(documentId)) {
                return current.filter((currentDocumentId) => currentDocumentId !== documentId);
            }

            return [...current, documentId];
        });
    };

    const handleSelectActiveExportDocument = () => {
        if (activeDocumentId === null) {
            setSelectedExportDocumentIds([]);
            return;
        }

        setSelectedExportDocumentIds([activeDocumentId]);
    };

    const handleSelectAllExportDocuments = () => {
        setSelectedExportDocumentIds(documents.map((document) => document.id));
    };

    const handleClearExportDocuments = () => {
        setSelectedExportDocumentIds([]);
    };

    const handleCancelExportDocuments = () => {
        setIsExportPanelOpen(false);
        setSelectedExportDocumentIds([]);
    };

    const handleExportSelectedDocuments = async () => {
        if (selectedExportDocumentIds.length === 0 || isExportingDocument) {
            return;
        }

        await onExportDocuments(selectedExportDocumentIds);
        setIsExportPanelOpen(false);
    };

    if (isCollapsed) {
        return (
            <aside className="documents-sidebar documents-sidebar--collapsed" aria-label="Biblioteca local colapsada">
                <div className="documents-rail">
                    <button
                        type="button"
                        className="documents-rail__button documents-rail__button--primary"
                        onClick={expandSidebar}
                        aria-label="Expandir biblioteca"
                        title="Expandir biblioteca"
                    >
                        <LibraryIcon />
                    </button>

                    <div className="documents-rail__divider" />

                    <button
                        type="button"
                        className="documents-rail__button"
                        onClick={handleExpandForCreate}
                        disabled={isCreating}
                        aria-label="Nuevo documento"
                        title="Nuevo documento"
                    >
                        <PlusIcon />
                    </button>

                    <button
                        type="button"
                        className="documents-rail__button"
                        onClick={() => void onImportDocuments()}
                        disabled={isCreating || isImportingDocuments || isExportingDocument}
                        aria-label="Importar documento"
                        title="Importar documento"
                    >
                        <ImportDocumentIcon />
                    </button>

                    <button
                        type="button"
                        className="documents-rail__button"
                        onClick={handleCollapsedExport}
                        disabled={!canOpenExportPanel}
                        aria-label="Exportar documentos"
                        title={documents.length === 0 ? 'No hay documentos para exportar' : 'Exportar documentos'}
                    >
                        <ExportDocumentIcon />
                    </button>

                    <div className="documents-rail__spacer" />
                </div>
            </aside>
        );
    }

    return (
        <aside className="documents-sidebar">
            <div className="documents-sidebar__header">
                <div className="documents-sidebar__header-copy">
                    <div className="documents-sidebar__eyebrow">P1 · documentos</div>
                    <h1 className="documents-sidebar__title">Biblioteca local</h1>
                </div>

                <button
                    type="button"
                    className="documents-sidebar__collapse-button"
                    onClick={() => onCollapsedChange(true)}
                    aria-label="Colapsar biblioteca"
                    title="Colapsar biblioteca"
                >
                    <CollapseSidebarIcon />
                </button>
            </div>

            <form className="documents-create-form" onSubmit={handleSubmit}>
                <label className="documents-create-form__label" htmlFor="document-title">
                    Nuevo documento
                </label>

                <input
                    ref={titleInputRef}
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
                        className={`documents-transfer-actions__button${isExportPanelOpen ? ' is-active' : ''}`}
                        onClick={handleOpenExportPanel}
                        disabled={!canOpenExportPanel}
                        title={
                            documents.length === 0
                                ? 'No hay documentos para exportar'
                                : 'Exportar documentos'
                        }
                        aria-label="Exportar documentos"
                    >
                        <ExportDocumentIcon />
                    </button>
                </div>

                {isExportPanelOpen ? (
                    <div className="documents-export-panel">
                        <div className="documents-export-panel__header">
                            <div className="documents-export-panel__title">Exportar documentos</div>
                            <button
                                type="button"
                                className="documents-export-panel__close"
                                onClick={handleCancelExportDocuments}
                                aria-label="Cerrar selección de exportación"
                                title="Cerrar"
                            >
                                ×
                            </button>
                        </div>

                        <div className="documents-export-panel__quick-actions">
                            <button
                                type="button"
                                className="documents-export-panel__quick-button"
                                onClick={handleSelectActiveExportDocument}
                                disabled={activeDocumentId === null || isExportingDocument}
                            >
                                Activo
                            </button>

                            <button
                                type="button"
                                className="documents-export-panel__quick-button"
                                onClick={handleSelectAllExportDocuments}
                                disabled={documents.length === 0 || isExportingDocument}
                            >
                                Todos
                            </button>

                            <button
                                type="button"
                                className="documents-export-panel__quick-button"
                                onClick={handleClearExportDocuments}
                                disabled={selectedExportDocumentIds.length === 0 || isExportingDocument}
                            >
                                Limpiar
                            </button>
                        </div>

                        <div className="documents-export-panel__list">
                            {documents.map((document) => {
                                const isChecked = selectedExportDocumentIdSet.has(document.id);

                                return (
                                    <label
                                        key={document.id}
                                        className={`documents-export-panel__item${isChecked ? ' is-selected' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="documents-export-panel__checkbox"
                                            checked={isChecked}
                                            onChange={() => handleToggleExportDocument(document.id)}
                                            disabled={isExportingDocument}
                                        />

                                        <span className="documents-export-panel__item-text">
                                            <span className="documents-export-panel__item-title">
                                                {document.title}
                                            </span>
                                            <span className="documents-export-panel__item-meta">
                                                #{document.id} · {formatTimestamp(document.updatedAt)}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>

                        <div className="documents-export-panel__footer">
                            <button
                                type="button"
                                className="documents-export-panel__secondary-button"
                                onClick={handleCancelExportDocuments}
                                disabled={isExportingDocument}
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                className="documents-export-panel__primary-button"
                                onClick={() => void handleExportSelectedDocuments()}
                                disabled={!hasExportSelection || isExportingDocument}
                            >
                                {isExportingDocument
                                    ? 'Exportando…'
                                    : `Exportar ${selectedExportDocumentIds.length}`}
                            </button>
                        </div>
                    </div>
                ) : null}


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
