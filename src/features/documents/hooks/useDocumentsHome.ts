import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
    DocumentListItem,
    NodeDto,
    OpenDocumentSnapshotDto,
} from '../../../shared/documents/contracts';
import { createChildNode } from '../api/createChildNode';
import { createDocument } from '../api/createDocument';
import { copyDocument } from '../api/copyDocument';
import { createDocumentFromNode } from '../api/createDocumentFromNode';
import { deleteDocument } from '../api/deleteDocument';
import { deleteLeafNode } from '../api/deleteLeafNode';
import { listDocuments } from '../api/listDocuments';
import { openDocument } from '../api/openDocument';
import { openLastOpenedDocument } from '../api/openLastOpenedDocument';
import { renameNode } from '../api/renameNode';
import { selectNode } from '../api/selectNode';
import { setNodeCollapsed } from '../api/setNodeCollapsed';
import { setNodeLearningStatus } from '../api/setNodeLearningStatus';
import { updateNodeContent } from '../api/updateNodeContent';
import { setDocumentViewport } from '../api/setDocumentViewport';

type HomeStatus = 'idle' | 'loading' | 'ready' | 'error';

function getErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return fallbackMessage;
}

function upsertDocumentListItem(
    documents: DocumentListItem[],
    snapshot: OpenDocumentSnapshotDto,
): DocumentListItem[] {
    const nextItem: DocumentListItem = {
        id: snapshot.document.id,
        title: snapshot.document.title,
        createdAt: snapshot.document.createdAt,
        updatedAt: snapshot.document.updatedAt,
    };

    const withoutCurrent = documents.filter((item) => item.id !== nextItem.id);

    return [nextItem, ...withoutCurrent].sort((a, b) => {
        if (b.updatedAt !== a.updatedAt) {
            return b.updatedAt - a.updatedAt;
        }

        return b.id - a.id;
    });
}

export function useDocumentsHome() {
    const [documents, setDocuments] = useState<DocumentListItem[]>([]);
    const [openedSnapshot, setOpenedSnapshot] =
        useState<OpenDocumentSnapshotDto | null>(null);
    const [status, setStatus] = useState<HomeStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isOpeningDocumentId, setIsOpeningDocumentId] = useState<number | null>(null);
    const [isDeletingDocumentId, setIsDeletingDocumentId] = useState<number | null>(null);
    const [isCopyingDocumentId, setIsCopyingDocumentId] = useState<number | null>(null);
    const [isCreatingDocumentFromNodeId, setIsCreatingDocumentFromNodeId] = useState<number | null>(null);
    const [isSavingContent, setIsSavingContent] = useState(false);
    const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
    const [isCreatingChild, setIsCreatingChild] = useState(false);
    const [isSelectingNodeId, setIsSelectingNodeId] = useState<number | null>(null);
    const [isTogglingCollapseNodeId, setIsTogglingCollapseNodeId] = useState<number | null>(null);
    const [isUpdatingLearningStatusNodeId, setIsUpdatingLearningStatusNodeId] = useState<number | null>(null);
    const [isRenamingNodeId, setIsRenamingNodeId] = useState<number | null>(null);
    const [isDeletingNodeId, setIsDeletingNodeId] = useState<number | null>(null);
    const [createDocumentFromNodeErrorMessage, setCreateDocumentFromNodeErrorMessage] = useState<string | null>(null);
    const [isSavingViewport] = useState(false);

    const hasAttemptedAutoOpenRef = useRef(false);

    const activeDocumentId = openedSnapshot?.document.id ?? null;

    const loadDocuments = useCallback(async () => {
        setStatus('loading');
        setErrorMessage(null);

        try {
            const nextDocuments = await listDocuments();
            setDocuments(nextDocuments);

            if (!hasAttemptedAutoOpenRef.current) {
                const snapshot = await openLastOpenedDocument();
                hasAttemptedAutoOpenRef.current = true;

                if (snapshot) {
                    setOpenedSnapshot(snapshot);
                    setDocuments(upsertDocumentListItem(nextDocuments, snapshot));
                }
            }

            setStatus('ready');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'No se pudieron cargar los documentos.';
            setErrorMessage(message);
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        void loadDocuments();
    }, [loadDocuments]);

    const handleCreateDocument = useCallback(async (title: string) => {
        setIsCreating(true);
        setErrorMessage(null);
        setSaveErrorMessage(null);

        try {
            const snapshot = await createDocument(title);
            setOpenedSnapshot(snapshot);
            setDocuments((current) => upsertDocumentListItem(current, snapshot));
            setStatus('ready');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'No se pudo crear el documento.';
            setErrorMessage(message);
            setStatus('error');
        } finally {
            setIsCreating(false);
        }
    }, []);

    const handleOpenDocument = useCallback(async (documentId: number) => {
        setIsOpeningDocumentId(documentId);
        setErrorMessage(null);
        setSaveErrorMessage(null);

        try {
            const snapshot = await openDocument(documentId);

            if (!snapshot) {
                setErrorMessage('El documento solicitado no existe.');
                setStatus('error');
                return;
            }

            setOpenedSnapshot(snapshot);
            setDocuments((current) => upsertDocumentListItem(current, snapshot));
            setStatus('ready');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'No se pudo abrir el documento.';
            setErrorMessage(message);
            setStatus('error');
        } finally {
            setIsOpeningDocumentId(null);
        }
    }, []);

    const handleDeleteDocument = useCallback(async (documentId: number) => {
        if (isDeletingDocumentId !== null) {
            return;
        }

        setIsDeletingDocumentId(documentId);
        setErrorMessage(null);
        setSaveErrorMessage(null);

        try {
            const nextSnapshot = await deleteDocument(documentId);
            const refreshedDocuments = await listDocuments();

            setDocuments(refreshedDocuments);

            setOpenedSnapshot((currentSnapshot) => {
                if (!currentSnapshot) {
                    return nextSnapshot;
                }

                if (currentSnapshot.document.id === documentId) {
                    return nextSnapshot;
                }

                return currentSnapshot;
            });

            setStatus('ready');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'No se pudo borrar el documento.';

            setErrorMessage(message);
            setStatus('error');
        } finally {
            setIsDeletingDocumentId(null);
        }
    }, [isDeletingDocumentId]);

    const handleCopyDocument = useCallback(async (sourceDocumentId: number) => {
        if (isCopyingDocumentId !== null || isDeletingDocumentId !== null) {
            return;
        }

        setIsCopyingDocumentId(sourceDocumentId);
        setErrorMessage(null);
        setSaveErrorMessage(null);

        try {
            const snapshot = await copyDocument(sourceDocumentId);

            if (!snapshot) {
                setErrorMessage('No se pudo copiar el documento porque ya no existe.');
                setStatus('error');
                return;
            }

            setOpenedSnapshot(snapshot);

            try {
                const refreshedDocuments = await listDocuments();
                setDocuments(refreshedDocuments);
            } catch {
                setDocuments((current) => upsertDocumentListItem(current, snapshot));
            }

            setStatus('ready');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'No se pudo copiar el documento.';

            setErrorMessage(message);
            setStatus('error');
        } finally {
            setIsCopyingDocumentId(null);
        }
    }, [isCopyingDocumentId, isDeletingDocumentId]);

    const handleCreateDocumentFromNode = useCallback(
        async (sourceDocumentId: number, sourceNodeId: number) => {
            setIsCreatingDocumentFromNodeId(sourceNodeId);
            setCreateDocumentFromNodeErrorMessage(null);
            setErrorMessage(null);
            setSaveErrorMessage(null);

            try {
                const snapshot = await createDocumentFromNode(
                    sourceDocumentId,
                    sourceNodeId,
                );

                if (!snapshot) {
                    throw new Error('No se pudo crear el documento desde el nodo seleccionado.');
                }

                setOpenedSnapshot(snapshot);
                setDocuments((current) => upsertDocumentListItem(current, snapshot));
                setStatus('ready');
            } catch (error) {
                const message = getErrorMessage(
                    error,
                    'No se pudo crear el documento desde el nodo.',
                );

                setCreateDocumentFromNodeErrorMessage(message);
                setStatus('ready');
            } finally {
                setIsCreatingDocumentFromNodeId(null);
            }
        },
        [],
    );

    const handleAutosaveSelectedNodeContent = useCallback(
        async (note: string, body: string) => {
            if (!openedSnapshot || !openedSnapshot.selectedNodeContent) {
                setSaveErrorMessage('No hay nodo seleccionado con contenido cargado.');
                return;
            }

            setIsSavingContent(true);
            setSaveErrorMessage(null);
            setErrorMessage(null);

            try {
                const normalizedNote = note.trim().length === 0 ? null : note;

                await updateNodeContent(
                    openedSnapshot.selectedNodeContent.nodeId,
                    normalizedNote,
                    body,
                );

                const refreshedSnapshot = await openDocument(openedSnapshot.document.id);

                if (!refreshedSnapshot) {
                    throw new Error('El documento guardado no se pudo recargar.');
                }

                setOpenedSnapshot(refreshedSnapshot);

                try {
                    const refreshedDocuments = await listDocuments();
                    setDocuments(refreshedDocuments);
                } catch {
                }

                setStatus('ready');
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'No se pudo guardar el contenido.';
                setSaveErrorMessage(message);
            } finally {
                setIsSavingContent(false);
            }
        },
        [openedSnapshot],
    );

    const handleCreateChildNode = useCallback(
        async (parentNodeId: number, title: string) => {
            setIsCreatingChild(true);
            setErrorMessage(null);
            setSaveErrorMessage(null);

            try {
                const snapshot = await createChildNode(parentNodeId, title);

                setOpenedSnapshot(snapshot);
                setDocuments((current) => upsertDocumentListItem(current, snapshot));
                setStatus('ready');
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'No se pudo crear el nodo hijo.';

                setErrorMessage(message);
                setStatus('error');
            } finally {
                setIsCreatingChild(false);
            }
        },
        [],
    );

    const handleSelectNode = useCallback(
        async (nodeId: number) => {
            if (!openedSnapshot) {
                return;
            }

            if (openedSnapshot.viewState.selectedNodeId === nodeId) {
                return;
            }

            setIsSelectingNodeId(nodeId);
            setErrorMessage(null);
            setSaveErrorMessage(null);

            try {
                const snapshot = await selectNode(openedSnapshot.document.id, nodeId);

                if (!snapshot) {
                    setErrorMessage('No se pudo seleccionar el nodo.');
                    setStatus('error');
                    return;
                }

                setOpenedSnapshot(snapshot);
                setDocuments((current) => upsertDocumentListItem(current, snapshot));
                setStatus('ready');
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'No se pudo cambiar la selección.';
                setErrorMessage(message);
                setStatus('error');
            } finally {
                setIsSelectingNodeId(null);
            }
        },
        [openedSnapshot],
    );

    const handleSetNodeCollapsed = useCallback(
        async (nodeId: number, isCollapsed: boolean) => {
            if (!openedSnapshot) {
                return;
            }

            setIsTogglingCollapseNodeId(nodeId);
            setErrorMessage(null);
            setSaveErrorMessage(null);

            try {
                const snapshot = await setNodeCollapsed(
                    openedSnapshot.document.id,
                    nodeId,
                    isCollapsed,
                );

                if (!snapshot) {
                    setErrorMessage('No se pudo actualizar el estado del nodo.');
                    setStatus('error');
                    return;
                }

                setOpenedSnapshot(snapshot);
                setDocuments((current) => upsertDocumentListItem(current, snapshot));
                setStatus('ready');
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'No se pudo actualizar el estado expandido o colapsado.';
                setErrorMessage(message);
                setStatus('error');
            } finally {
                setIsTogglingCollapseNodeId(null);
            }
        },
        [openedSnapshot],
    );

    const handleSetNodeLearningStatus = useCallback(
        async (nodeId: number, learningStatus: NodeDto['learningStatus']) => {
            if (!openedSnapshot) {
                return;
            }

            setIsUpdatingLearningStatusNodeId(nodeId);
            setErrorMessage(null);
            setSaveErrorMessage(null);

            try {
                const snapshot = await setNodeLearningStatus(
                    openedSnapshot.document.id,
                    nodeId,
                    learningStatus,
                );

                if (!snapshot) {
                    setErrorMessage('No se pudo actualizar el estado de aprendizaje.');
                    setStatus('error');
                    return;
                }

                setOpenedSnapshot(snapshot);
                setDocuments((current) => upsertDocumentListItem(current, snapshot));
                setStatus('ready');
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'No se pudo actualizar el estado de aprendizaje.';
                setErrorMessage(message);
                setStatus('error');
            } finally {
                setIsUpdatingLearningStatusNodeId(null);
            }
        },
        [openedSnapshot],
    );

    const handleRenameNode = useCallback(
        async (nodeId: number, title: string) => {
            if (!openedSnapshot) {
                return;
            }

            setIsRenamingNodeId(nodeId);
            setErrorMessage(null);
            setSaveErrorMessage(null);

            try {
                const snapshot = await renameNode(openedSnapshot.document.id, nodeId, title);

                if (!snapshot) {
                    setErrorMessage('No se pudo renombrar el nodo.');
                    setStatus('error');
                    return;
                }

                setOpenedSnapshot(snapshot);
                setDocuments((current) => upsertDocumentListItem(current, snapshot));
                setStatus('ready');
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'No se pudo renombrar el nodo.';
                setErrorMessage(message);
                setStatus('error');
            } finally {
                setIsRenamingNodeId(null);
            }
        },
        [openedSnapshot],
    );

    const handleDeleteLeafNode = useCallback(
        async (nodeId: number) => {
            if (!openedSnapshot) {
                return;
            }

            setIsDeletingNodeId(nodeId);
            setErrorMessage(null);
            setSaveErrorMessage(null);

            try {
                const snapshot = await deleteLeafNode(openedSnapshot.document.id, nodeId);

                if (!snapshot) {
                    setErrorMessage('No se pudo eliminar el nodo.');
                    setStatus('error');
                    return;
                }

                setOpenedSnapshot(snapshot);
                setDocuments((current) => upsertDocumentListItem(current, snapshot));
                setStatus('ready');
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'No se pudo eliminar el nodo.';
                setErrorMessage(message);
                setStatus('error');
            } finally {
                setIsDeletingNodeId(null);
            }
        },
        [openedSnapshot],
    );

    const saveViewport = useCallback(
        async (documentId: number, panX: number, panY: number, zoom: number) => {
            try {
                await setDocumentViewport({
                    documentId,
                    panX,
                    panY,
                    zoom,
                });

                setOpenedSnapshot((currentSnapshot) => {
                    if (!currentSnapshot || currentSnapshot.document.id !== documentId) {
                        return currentSnapshot;
                    }

                    return {
                        ...currentSnapshot,
                        viewState: {
                            ...currentSnapshot.viewState,
                            panX,
                            panY,
                            zoom,
                            updatedAt: Date.now(),
                        },
                    };
                });
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'No se pudo guardar el viewport del documento.';

                setErrorMessage(message);
            }
        },
        [],
    );

    const derived = useMemo(() => {
        return {
            hasDocuments: documents.length > 0,
            hasOpenedDocument: openedSnapshot !== null,
        };
    }, [documents.length, openedSnapshot]);

    return {
        documents,
        openedSnapshot,
        activeDocumentId,
        status,
        errorMessage,
        isCreating,
        isOpeningDocumentId,
        isDeletingDocumentId,
        isCopyingDocumentId,
        isCreatingDocumentFromNodeId,
        createDocumentFromNodeErrorMessage,
        isSavingContent,
        saveErrorMessage,
        isCreatingChild,
        isSelectingNodeId,
        isTogglingCollapseNodeId,
        isUpdatingLearningStatusNodeId,
        isRenamingNodeId,
        isDeletingNodeId,
        hasDocuments: derived.hasDocuments,
        hasOpenedDocument: derived.hasOpenedDocument,
        loadDocuments,
        createDocument: handleCreateDocument,
        openDocument: handleOpenDocument,
        deleteDocument: handleDeleteDocument,
        copyDocument: handleCopyDocument,
        createDocumentFromNode: handleCreateDocumentFromNode,
        autosaveSelectedNodeContent: handleAutosaveSelectedNodeContent,
        createChildNode: handleCreateChildNode,
        selectNode: handleSelectNode,
        setNodeCollapsed: handleSetNodeCollapsed,
        setNodeLearningStatus: handleSetNodeLearningStatus,
        renameNode: handleRenameNode,
        deleteLeafNode: handleDeleteLeafNode,
        isSavingViewport,
        saveViewport,
    };
}