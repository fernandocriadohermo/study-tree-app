import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import type {
    DocumentListItem,
    NodeDto,
    OpenDocumentSnapshotDto,
    SelectedNodeContentDto,
} from './shared/documents/contracts';

const documentsFixture: DocumentListItem[] = [
    {
        id: 2,
        title: 'Tema 02 · Procedimiento administrativo',
        createdAt: 1713600300000,
        updatedAt: 1713600400000,
    },
    {
        id: 1,
        title: 'Tema 01 · Organización institucional',
        createdAt: 1713600000000,
        updatedAt: 1713600100000,
    },
];

function buildRootNode(overrides?: Partial<NodeDto>): NodeDto {
    return {
        id: 101,
        documentId: 1,
        parentId: null,
        title: 'Tema 01 · Organización institucional',
        learningStatus: 'sin_ver',
        isCollapsed: false,
        siblingOrder: 0,
        createdAt: 1713600000000,
        updatedAt: 1713600100000,
        ...overrides,
    };
}

function buildChildNode(overrides?: Partial<NodeDto>): NodeDto {
    return {
        id: 102,
        documentId: 1,
        parentId: 101,
        title: 'Epígrafe 1',
        learningStatus: 'sin_ver',
        isCollapsed: false,
        siblingOrder: 0,
        createdAt: 1713600200000,
        updatedAt: 1713600200000,
        ...overrides,
    };
}

function buildGrandchildNode(overrides?: Partial<NodeDto>): NodeDto {
    return {
        id: 103,
        documentId: 1,
        parentId: 102,
        title: 'Subepígrafe 1.1',
        learningStatus: 'sin_ver',
        isCollapsed: false,
        siblingOrder: 0,
        createdAt: 1713600300000,
        updatedAt: 1713600300000,
        ...overrides,
    };
}

function buildSnapshot(
    overrides?: Partial<OpenDocumentSnapshotDto>,
): OpenDocumentSnapshotDto {
    return {
        document: {
            id: 1,
            title: 'Tema 01 · Organización institucional',
            createdAt: 1713600000000,
            updatedAt: 1713600100000,
        },
        rootNodeId: 101,
        nodes: [buildRootNode()],
        nodeContents: [
            {
                nodeId: 101,
                note: null,
                body: '',
            },
        ],
        viewState: {
            documentId: 1,
            selectedNodeId: 101,
            panX: 0,
            panY: 0,
            zoom: 1,
            updatedAt: 1713600100000,
        },
        selectedNodeContent: {
            nodeId: 101,
            note: null,
            body: '',
            createdAt: 1713600000000,
            updatedAt: 1713600100000,
        },
        ...overrides,
    };
}

function mockDocumentsIpc(
    handler: (cmd: string, payload: unknown) => unknown,
) {
    mockIPC((cmd, payload) => {
        if (cmd === 'open_last_opened_document') {
            return null;
        }

        return handler(cmd, payload);
    });
}

async function openDocumentFromSidebar(documentName: RegExp | string) {
    fireEvent.click(
        await screen.findByRole('button', {
            name: documentName,
        }),
    );

    await screen.findByRole('heading', {
        name: documentName,
    });
}

async function switchToMixedWorkspaceIfNeeded() {
    if (screen.queryByLabelText('Título del nodo')) {
        return;
    }

    fireEvent.click(
        await screen.findByRole('button', {
            name: 'Vista mixta',
        }),
    );

    await screen.findByLabelText('Título del nodo');
}

describe('App', () => {
    it('reabre automáticamente el último documento al iniciar', async () => {
        mockIPC((cmd) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_last_opened_document':
                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600100000,
                        },
                        nodes: [buildRootNode(), buildChildNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600200000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600200000,
                            updatedAt: 1713600200000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        expect(
            await screen.findByRole('heading', {
                name: 'Tema 01 · Organización institucional',
            }),
        ).toBeInTheDocument();

        expect(screen.getByTestId('tree-canvas')).toBeInTheDocument();
        expect(screen.getByText('Selección activa: nodo #102')).toBeInTheDocument();
        expect(screen.getByTestId('tree-node-102-button')).toBeInTheDocument();
    });

    it('lista documentos reales y abre uno para renderizar el root', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;
                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });
                    return buildSnapshot();
                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        expect(
            await screen.findByText('Tema 01 · Organización institucional'),
        ).toBeInTheDocument();

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);

        expect(
            await screen.findByRole('heading', {
                name: 'Tema 01 · Organización institucional',
            }),
        ).toBeInTheDocument();

        expect(screen.getByTestId('tree-canvas')).toBeInTheDocument();
        expect(await screen.findByTestId('tree-node-101-button')).toBeInTheDocument();
    });

    it('crea documento real, lo abre y renderiza su root', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return [];
                case 'create_document':
                    expect(payload).toEqual({
                        input: {
                            title: 'Tema 03 · Contratación pública',
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 3,
                            title: 'Tema 03 · Contratación pública',
                            createdAt: 1713600500000,
                            updatedAt: 1713600600000,
                        },
                        rootNodeId: 301,
                        nodes: [
                            buildRootNode({
                                id: 301,
                                documentId: 3,
                                title: 'Tema 03 · Contratación pública',
                                createdAt: 1713600500000,
                                updatedAt: 1713600600000,
                            }),
                        ],
                        viewState: {
                            documentId: 3,
                            selectedNodeId: 301,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600600000,
                        },
                        selectedNodeContent: {
                            nodeId: 301,
                            note: null,
                            body: '',
                            createdAt: 1713600500000,
                            updatedAt: 1713600600000,
                        },
                    });
                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        const input = await screen.findByLabelText('Nuevo documento');
        fireEvent.change(input, {
            target: { value: 'Tema 03 · Contratación pública' },
        });

        fireEvent.click(
            screen.getByRole('button', { name: 'Crear documento' }),
        );

        expect(
            await screen.findByRole('heading', {
                name: 'Tema 03 · Contratación pública',
            }),
        ).toBeInTheDocument();

        expect(await screen.findByTestId('tree-node-301-button')).toBeInTheDocument();
    });

    it('crea un hijo bajo el root y permite seleccionarlo', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });
                    return buildSnapshot();

                case 'create_child_node':
                    expect(payload).toEqual({
                        input: {
                            parentNodeId: 101,
                            title: 'Epígrafe 1',
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600200000,
                        },
                        nodes: [buildRootNode(), buildChildNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600200000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600200000,
                            updatedAt: 1713600200000,
                        },
                    });

                case 'select_node':
                    expect(payload).toEqual({
                        input: {
                            documentId: 1,
                            nodeId: 101,
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600200000,
                        },
                        nodes: [buildRootNode(), buildChildNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 101,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600200000,
                        },
                        selectedNodeContent: {
                            nodeId: 101,
                            note: null,
                            body: '',
                            createdAt: 1713600000000,
                            updatedAt: 1713600100000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);
        await switchToMixedWorkspaceIfNeeded();

        const childTitleInput = await screen.findByLabelText('Nuevo hijo del nodo seleccionado');

        fireEvent.change(childTitleInput, {
            target: { value: 'Epígrafe 1' },
        });

        fireEvent.click(
            screen.getByRole('button', { name: 'Crear hijo' }),
        );

        expect(await screen.findByTestId('tree-node-102-button')).toBeInTheDocument();
        expect(screen.getByText('Selección activa: nodo #102')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('tree-node-101-button'));

        await waitFor(() => {
            expect(screen.getByText('Selección activa: nodo #101')).toBeInTheDocument();
        });
    });

    it('crea un nieto bajo un hijo seleccionado y permite seleccionarlo', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });
                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600200000,
                        },
                        nodes: [buildRootNode(), buildChildNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 101,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600200000,
                        },
                        selectedNodeContent: {
                            nodeId: 101,
                            note: null,
                            body: '',
                            createdAt: 1713600000000,
                            updatedAt: 1713600100000,
                        },
                    });

                case 'select_node':
                    if (
                        JSON.stringify(payload) ===
                        JSON.stringify({
                            input: {
                                documentId: 1,
                                nodeId: 102,
                            },
                        })
                    ) {
                        return buildSnapshot({
                            document: {
                                id: 1,
                                title: 'Tema 01 · Organización institucional',
                                createdAt: 1713600000000,
                                updatedAt: 1713600200000,
                            },
                            nodes: [buildRootNode(), buildChildNode()],
                            viewState: {
                                documentId: 1,
                                selectedNodeId: 102,
                                panX: 0,
                                panY: 0,
                                zoom: 1,
                                updatedAt: 1713600200000,
                            },
                            selectedNodeContent: {
                                nodeId: 102,
                                note: null,
                                body: '',
                                createdAt: 1713600200000,
                                updatedAt: 1713600200000,
                            },
                        });
                    }

                    if (
                        JSON.stringify(payload) ===
                        JSON.stringify({
                            input: {
                                documentId: 1,
                                nodeId: 103,
                            },
                        })
                    ) {
                        return buildSnapshot({
                            document: {
                                id: 1,
                                title: 'Tema 01 · Organización institucional',
                                createdAt: 1713600000000,
                                updatedAt: 1713600300000,
                            },
                            nodes: [buildRootNode(), buildChildNode(), buildGrandchildNode()],
                            viewState: {
                                documentId: 1,
                                selectedNodeId: 103,
                                panX: 0,
                                panY: 0,
                                zoom: 1,
                                updatedAt: 1713600300000,
                            },
                            selectedNodeContent: {
                                nodeId: 103,
                                note: null,
                                body: '',
                                createdAt: 1713600300000,
                                updatedAt: 1713600300000,
                            },
                        });
                    }

                    if (
                        JSON.stringify(payload) ===
                        JSON.stringify({
                            input: {
                                documentId: 1,
                                nodeId: 101,
                            },
                        })
                    ) {
                        return buildSnapshot({
                            document: {
                                id: 1,
                                title: 'Tema 01 · Organización institucional',
                                createdAt: 1713600000000,
                                updatedAt: 1713600300000,
                            },
                            nodes: [buildRootNode(), buildChildNode(), buildGrandchildNode()],
                            viewState: {
                                documentId: 1,
                                selectedNodeId: 101,
                                panX: 0,
                                panY: 0,
                                zoom: 1,
                                updatedAt: 1713600300000,
                            },
                            selectedNodeContent: {
                                nodeId: 101,
                                note: null,
                                body: '',
                                createdAt: 1713600000000,
                                updatedAt: 1713600100000,
                            },
                        });
                    }

                    throw new Error(`Payload inesperado en select_node: ${JSON.stringify(payload)}`);

                case 'create_child_node':
                    expect(payload).toEqual({
                        input: {
                            parentNodeId: 102,
                            title: 'Subepígrafe 1.1',
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600300000,
                        },
                        nodes: [buildRootNode(), buildChildNode(), buildGrandchildNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 103,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600300000,
                        },
                        selectedNodeContent: {
                            nodeId: 103,
                            note: null,
                            body: '',
                            createdAt: 1713600300000,
                            updatedAt: 1713600300000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);
        await switchToMixedWorkspaceIfNeeded();

        fireEvent.click(await screen.findByTestId('tree-node-102-button'));

        await waitFor(() => {
            expect(screen.getByText('Selección activa: nodo #102')).toBeInTheDocument();
        });

        const childTitleInput = await screen.findByLabelText('Nuevo hijo del nodo seleccionado');

        fireEvent.change(childTitleInput, {
            target: { value: 'Subepígrafe 1.1' },
        });

        fireEvent.click(
            screen.getByRole('button', { name: 'Crear hijo' }),
        );

        expect(await screen.findByTestId('tree-node-103-button')).toBeInTheDocument();
        expect(screen.getByText('Selección activa: nodo #103')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('tree-node-101-button'));

        await waitFor(() => {
            expect(screen.getByText('Selección activa: nodo #101')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('tree-node-103-button'));

        await waitFor(() => {
            expect(screen.getByText('Selección activa: nodo #103')).toBeInTheDocument();
        });
    });

    it('expande antes de crear un hijo bajo un nodo seleccionado colapsado para que aparezca en el canvas', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });
                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600300000,
                        },
                        nodes: [
                            buildRootNode(),
                            buildChildNode({
                                id: 102,
                                title: 'Epígrafe colapsado',
                                isCollapsed: true,
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600300000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600200000,
                            updatedAt: 1713600200000,
                        },
                    });

                case 'set_node_collapsed':
                    expect(payload).toEqual({
                        input: {
                            documentId: 1,
                            nodeId: 102,
                            isCollapsed: false,
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600310000,
                        },
                        nodes: [
                            buildRootNode(),
                            buildChildNode({
                                id: 102,
                                title: 'Epígrafe colapsado',
                                isCollapsed: false,
                                updatedAt: 1713600310000,
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600310000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600200000,
                            updatedAt: 1713600200000,
                        },
                    });

                case 'create_child_node':
                    expect(payload).toEqual({
                        input: {
                            parentNodeId: 102,
                            title: 'Subepígrafe visible',
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600320000,
                        },
                        nodes: [
                            buildRootNode(),
                            buildChildNode({
                                id: 102,
                                title: 'Epígrafe colapsado',
                                isCollapsed: false,
                                updatedAt: 1713600310000,
                            }),
                            buildGrandchildNode({
                                id: 103,
                                parentId: 102,
                                title: 'Subepígrafe visible',
                                createdAt: 1713600320000,
                                updatedAt: 1713600320000,
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 103,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600320000,
                        },
                        selectedNodeContent: {
                            nodeId: 103,
                            note: null,
                            body: '',
                            createdAt: 1713600320000,
                            updatedAt: 1713600320000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);
        await switchToMixedWorkspaceIfNeeded();

        expect(
            await screen.findByText('Selección activa: nodo #102'),
        ).toBeInTheDocument();

        const childTitleInput = await screen.findByLabelText(
            'Nuevo hijo del nodo seleccionado',
        );

        fireEvent.change(childTitleInput, {
            target: { value: 'Subepígrafe visible' },
        });

        fireEvent.click(
            screen.getByRole('button', { name: 'Crear hijo' }),
        );

        await waitFor(() => {
            expect(screen.getByText('Selección activa: nodo #103')).toBeInTheDocument();
            expect(screen.getByTestId('tree-node-103-button')).toBeInTheDocument();
        });
    });

    it('hace autosave sobre un nieto seleccionado tras el debounce', async () => {
        let currentSnapshot = buildSnapshot({
            document: {
                id: 1,
                title: 'Tema 01 · Organización institucional',
                createdAt: 1713600000000,
                updatedAt: 1713600300000,
            },
            nodes: [buildRootNode(), buildChildNode(), buildGrandchildNode()],
            viewState: {
                documentId: 1,
                selectedNodeId: 103,
                panX: 0,
                panY: 0,
                zoom: 1,
                updatedAt: 1713600300000,
            },
            selectedNodeContent: {
                nodeId: 103,
                note: null,
                body: '',
                createdAt: 1713600300000,
                updatedAt: 1713600300000,
            },
        });

        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });
                    return currentSnapshot;

                case 'update_node_content':
                    expect(payload).toEqual({
                        input: {
                            nodeId: 103,
                            note: 'Nota del nieto',
                            body: '',
                        },
                    });

                    currentSnapshot = buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600400000,
                        },
                        nodes: [buildRootNode(), buildChildNode(), buildGrandchildNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 103,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600400000,
                        },
                        selectedNodeContent: {
                            nodeId: 103,
                            note: 'Nota del nieto',
                            body: '',
                            createdAt: 1713600300000,
                            updatedAt: 1713600400000,
                        },
                    });

                    return {
                        nodeId: 103,
                        note: 'Nota del nieto',
                        body: '',
                        createdAt: 1713600300000,
                        updatedAt: 1713600400000,
                    } satisfies SelectedNodeContentDto;

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);
        await switchToMixedWorkspaceIfNeeded();

        const noteInput = await screen.findByLabelText('Nota');


        try {
            vi.useFakeTimers();

            fireEvent.change(noteInput, {
                target: { value: 'Nota del nieto' },
            });



            expect(
                screen.getByText('Cambios pendientes. Guardado automático en breve.'),
            ).toBeInTheDocument();

            await act(async () => {
                vi.advanceTimersByTime(900);
            });
        } finally {
            vi.useRealTimers();
        }

        await waitFor(() => {
            expect(screen.getByDisplayValue('Nota del nieto')).toBeInTheDocument();
        });
    });

    it('colapsa y expande un nodo con descendientes en la vista', async () => {
        let isCollapsed = false;

        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });
                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600300000,
                        },
                        nodes: [buildRootNode(), buildChildNode(), buildGrandchildNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600300000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600200000,
                            updatedAt: 1713600200000,
                        },
                    });

                case 'set_node_collapsed':
                    if (!isCollapsed) {
                        expect(payload).toEqual({
                            input: {
                                documentId: 1,
                                nodeId: 102,
                                isCollapsed: true,
                            },
                        });

                        isCollapsed = true;

                        return buildSnapshot({
                            document: {
                                id: 1,
                                title: 'Tema 01 · Organización institucional',
                                createdAt: 1713600000000,
                                updatedAt: 1713600400000,
                            },
                            nodes: [
                                buildRootNode(),
                                buildChildNode({ isCollapsed: true, updatedAt: 1713600400000 }),
                                buildGrandchildNode(),
                            ],
                            viewState: {
                                documentId: 1,
                                selectedNodeId: 102,
                                panX: 0,
                                panY: 0,
                                zoom: 1,
                                updatedAt: 1713600400000,
                            },
                            selectedNodeContent: {
                                nodeId: 102,
                                note: null,
                                body: '',
                                createdAt: 1713600200000,
                                updatedAt: 1713600200000,
                            },
                        });
                    }

                    expect(payload).toEqual({
                        input: {
                            documentId: 1,
                            nodeId: 102,
                            isCollapsed: false,
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600500000,
                        },
                        nodes: [
                            buildRootNode(),
                            buildChildNode({ isCollapsed: false, updatedAt: 1713600500000 }),
                            buildGrandchildNode(),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600500000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600200000,
                            updatedAt: 1713600200000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);
        await switchToMixedWorkspaceIfNeeded();

        expect(await screen.findByTestId('tree-node-103-button')).toBeInTheDocument();

        fireEvent.click(await screen.findByTestId('toggle-node-102-button'));

        await waitFor(() => {
            expect(screen.queryByTestId('tree-node-103-button')).not.toBeInTheDocument();
        });

        fireEvent.click(await screen.findByTestId('toggle-node-102-button'));

        await waitFor(() => {
            expect(screen.getByTestId('tree-node-103-button')).toBeInTheDocument();
        });
    });

    it('muestra en el canvas si una rama está expandida o colapsada', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600400000,
                        },
                        nodes: [
                            buildRootNode(),
                            buildChildNode({
                                id: 102,
                                title: 'Rama principal',
                                isCollapsed: false,
                                updatedAt: 1713600400000,
                            }),
                            buildGrandchildNode({
                                id: 103,
                                parentId: 102,
                                title: 'Nieto visible',
                                createdAt: 1713600405000,
                                updatedAt: 1713600405000,
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600400000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600400000,
                            updatedAt: 1713600400000,
                        },
                    });

                case 'set_node_collapsed':
                    expect(payload).toEqual({
                        input: {
                            documentId: 1,
                            nodeId: 102,
                            isCollapsed: true,
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600410000,
                        },
                        nodes: [
                            buildRootNode(),
                            buildChildNode({
                                id: 102,
                                title: 'Rama principal',
                                isCollapsed: true,
                                updatedAt: 1713600410000,
                            }),
                            buildGrandchildNode({
                                id: 103,
                                parentId: 102,
                                title: 'Nieto visible',
                                createdAt: 1713600405000,
                                updatedAt: 1713600405000,
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600410000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600400000,
                            updatedAt: 1713600400000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);
        await switchToMixedWorkspaceIfNeeded();

        expect(
            await screen.findByTestId('tree-node-102-collapse-badge'),
        ).toHaveTextContent('− rama');

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Colapsar rama',
            }),
        );

        await waitFor(() => {
            expect(screen.getByTestId('tree-node-102-collapse-badge')).toHaveTextContent(
                '+ rama',
            );
        });
    });

    it('permite colapsar y expandir una rama directamente desde el canvas', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600500000,
                        },
                        nodes: [
                            buildRootNode(),
                            buildChildNode({
                                id: 102,
                                title: 'Rama interactiva',
                                isCollapsed: false,
                                updatedAt: 1713600500000,
                            }),
                            buildGrandchildNode({
                                id: 103,
                                parentId: 102,
                                title: 'Nieto visible',
                                createdAt: 1713600505000,
                                updatedAt: 1713600505000,
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600500000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600500000,
                            updatedAt: 1713600500000,
                        },
                    });

                case 'set_node_collapsed':
                    expect(payload).toEqual({
                        input: {
                            documentId: 1,
                            nodeId: 102,
                            isCollapsed: true,
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600510000,
                        },
                        nodes: [
                            buildRootNode(),
                            buildChildNode({
                                id: 102,
                                title: 'Rama interactiva',
                                isCollapsed: true,
                                updatedAt: 1713600510000,
                            }),
                            buildGrandchildNode({
                                id: 103,
                                parentId: 102,
                                title: 'Nieto visible',
                                createdAt: 1713600505000,
                                updatedAt: 1713600505000,
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600510000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600500000,
                            updatedAt: 1713600500000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);

        expect(
            await screen.findByTestId('tree-node-102-collapse-badge'),
        ).toHaveTextContent('− rama');

        expect(screen.getByTestId('tree-node-103-button')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('tree-node-102-collapse-badge'));

        await waitFor(() => {
            expect(screen.getByTestId('tree-node-102-collapse-badge')).toHaveTextContent(
                '+ rama',
            );
            expect(screen.queryByTestId('tree-node-103-button')).not.toBeInTheDocument();
        });
    });

    it('cambia el estado de aprendizaje del nodo seleccionado y actualiza la vista', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });
                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600300000,
                        },
                        nodes: [buildRootNode(), buildChildNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600300000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600200000,
                            updatedAt: 1713600200000,
                        },
                    });

                case 'set_node_learning_status':
                    expect(payload).toEqual({
                        input: {
                            documentId: 1,
                            nodeId: 102,
                            learningStatus: 'dominado',
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600400000,
                        },
                        nodes: [buildRootNode(), buildChildNode({ learningStatus: 'dominado' })],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600400000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600200000,
                            updatedAt: 1713600200000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);
        await switchToMixedWorkspaceIfNeeded();

        const statusSelect = await screen.findByLabelText('Estado de aprendizaje');

        expect(statusSelect).toHaveValue('sin_ver');

        fireEvent.change(statusSelect, {
            target: { value: 'dominado' },
        });

        await waitFor(() => {
            expect(screen.getByLabelText('Estado de aprendizaje')).toHaveValue('dominado');
            expect(
                screen.getByTestId('tree-node-102-quick-status-select'),
            ).toHaveValue('dominado');
        });
    });

    it('renombra el nodo seleccionado y actualiza la vista', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });
                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600300000,
                        },
                        nodes: [buildRootNode(), buildChildNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600300000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: 'nota del hijo',
                            body: 'contenido del hijo',
                            createdAt: 1713600200000,
                            updatedAt: 1713600200000,
                        },
                    });

                case 'rename_node':
                    expect(payload).toEqual({
                        input: {
                            documentId: 1,
                            nodeId: 102,
                            title: 'Epígrafe 1 renombrado',
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600400000,
                        },
                        nodes: [buildRootNode(), buildChildNode({ title: 'Epígrafe 1 renombrado' })],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600400000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: 'nota del hijo',
                            body: 'contenido del hijo',
                            createdAt: 1713600200000,
                            updatedAt: 1713600200000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);
        await switchToMixedWorkspaceIfNeeded();

        const titleInput = await screen.findByLabelText('Título del nodo');

        fireEvent.change(titleInput, {
            target: { value: 'Epígrafe 1 renombrado' },
        });

        fireEvent.blur(titleInput);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Epígrafe 1 renombrado')).toBeInTheDocument();
            expect(screen.getByTestId('tree-node-102-button')).toHaveTextContent(
                'Epígrafe 1 renombrado',
            );
        });
    });

    it('renombra el root y actualiza también el documento en la barra lateral', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return [documentsFixture[1]];

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });
                    return buildSnapshot();

                case 'rename_node':
                    expect(payload).toEqual({
                        input: {
                            documentId: 1,
                            nodeId: 101,
                            title: 'Tema 01 · Organización general del Estado',
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización general del Estado',
                            createdAt: 1713600000000,
                            updatedAt: 1713600500000,
                        },
                        nodes: [
                            buildRootNode({
                                title: 'Tema 01 · Organización general del Estado',
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 101,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600500000,
                        },
                        selectedNodeContent: {
                            nodeId: 101,
                            note: null,
                            body: '',
                            createdAt: 1713600000000,
                            updatedAt: 1713600100000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);
        await switchToMixedWorkspaceIfNeeded();

        const titleInput = await screen.findByLabelText('Título del nodo');

        fireEvent.change(titleInput, {
            target: { value: 'Tema 01 · Organización general del Estado' },
        });

        fireEvent.blur(titleInput);

        await waitFor(() => {
            expect(
                screen.getByRole('heading', {
                    name: 'Tema 01 · Organización general del Estado',
                }),
            ).toBeInTheDocument();

            const documentsList = screen.getByRole('list', {
                name: 'Lista de documentos',
            });

            expect(
                within(documentsList).getByRole('button', {
                    name: /Tema 01 · Organización general del Estado/i,
                }),
            ).toBeInTheDocument();
        });
    });

    it('elimina un nodo hoja seleccionado y mueve la selección al padre', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });
                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600300000,
                        },
                        nodes: [buildRootNode(), buildChildNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600300000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600200000,
                            updatedAt: 1713600200000,
                        },
                    });

                case 'delete_leaf_node':
                    expect(payload).toEqual({
                        input: {
                            documentId: 1,
                            nodeId: 102,
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600400000,
                        },
                        nodes: [buildRootNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 101,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600400000,
                        },
                        selectedNodeContent: {
                            nodeId: 101,
                            note: null,
                            body: '',
                            createdAt: 1713600000000,
                            updatedAt: 1713600100000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);
        await switchToMixedWorkspaceIfNeeded();

        await screen.findByText('Selección activa: nodo #102');

        const deleteButton = await screen.findByRole('button', {
            name: 'Eliminar nodo hoja',
        });

        expect(deleteButton).toBeEnabled();

        fireEvent.click(deleteButton);

        await waitFor(() => {
            expect(screen.queryByTestId('tree-node-102-button')).not.toBeInTheDocument();
            expect(screen.getByText('Selección activa: nodo #101')).toBeInTheDocument();
        });

        expect(
            screen.getByRole('button', { name: 'Eliminar nodo hoja' }),
        ).toBeDisabled();
    });

    it('reaplica el viewport guardado al abrir el documento', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600700000,
                        },
                        nodes: [
                            buildRootNode(),
                            buildChildNode({
                                id: 102,
                                title: 'Primer hijo de prueba',
                                siblingOrder: 0,
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 101,
                            panX: -180,
                            panY: 96,
                            zoom: 0.72,
                            updatedAt: 1713600700000,
                        },
                        selectedNodeContent: {
                            nodeId: 101,
                            note: null,
                            body: '',
                            createdAt: 1713600700000,
                            updatedAt: 1713600700000,
                        },
                    });

                case 'set_document_viewport':
                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600700000,
                        },
                        nodes: [
                            buildRootNode(),
                            buildChildNode({
                                id: 102,
                                title: 'Primer hijo de prueba',
                                siblingOrder: 0,
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 101,
                            panX: -180,
                            panY: 96,
                            zoom: 0.72,
                            updatedAt: 1713600700000,
                        },
                        selectedNodeContent: {
                            nodeId: 101,
                            note: null,
                            body: '',
                            createdAt: 1713600700000,
                            updatedAt: 1713600700000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);

        expect(await screen.findByTestId('tree-canvas')).toBeInTheDocument();
        expect(
            await screen.findByText('Selección activa: nodo #101'),
        ).toBeInTheDocument();
    });

    it('permite cambiar el estado de una hoja desde el canvas', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600800000,
                        },
                        nodes: [
                            buildRootNode(),
                            buildChildNode({
                                id: 102,
                                title: 'Epígrafe hoja',
                                siblingOrder: 0,
                                learningStatus: 'sin_ver',
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600800000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600800000,
                            updatedAt: 1713600800000,
                        },
                    });

                case 'set_node_learning_status':
                    expect(payload).toEqual({
                        input: {
                            documentId: 1,
                            nodeId: 102,
                            learningStatus: 'visto',
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600810000,
                        },
                        nodes: [
                            buildRootNode({
                                learningStatus: 'visto',
                                updatedAt: 1713600810000,
                            }),
                            buildChildNode({
                                id: 102,
                                title: 'Epígrafe hoja',
                                siblingOrder: 0,
                                learningStatus: 'visto',
                                updatedAt: 1713600810000,
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600810000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600800000,
                            updatedAt: 1713600800000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);

        const quickStatusSelect = await screen.findByTestId(
            'tree-node-102-quick-status-select',
        );

        expect(quickStatusSelect).toHaveValue('sin_ver');

        fireEvent.change(quickStatusSelect, {
            target: { value: 'visto' },
        });

        await waitFor(() => {
            expect(
                screen.getByTestId('tree-node-102-quick-status-select'),
            ).toHaveValue('visto');
        });
    });

    it('abre el documento en canvas ampliado y permite pasar a vista mixta', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600900000,
                        },
                        nodes: [buildRootNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 101,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600900000,
                        },
                        selectedNodeContent: {
                            nodeId: 101,
                            note: null,
                            body: '',
                            createdAt: 1713600900000,
                            updatedAt: 1713600900000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);

        expect(await screen.findByTestId('tree-canvas')).toBeInTheDocument();
        expect(
            screen.queryByLabelText('Estado de aprendizaje'),
        ).not.toBeInTheDocument();

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Vista mixta',
            }),
        );

        expect(
            await screen.findByLabelText('Estado de aprendizaje'),
        ).toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: 'Ampliar árbol',
            }),
        ).toBeInTheDocument();
    });

    it('permite pasar de vista mixta a ficha ampliada y volver al árbol', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600900000,
                        },
                        nodes: [buildRootNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 101,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600900000,
                        },
                        selectedNodeContent: {
                            nodeId: 101,
                            note: null,
                            body: '',
                            createdAt: 1713600900000,
                            updatedAt: 1713600900000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Vista mixta',
            }),
        );

        expect(await screen.findByTestId('tree-canvas')).toBeInTheDocument();
        expect(
            await screen.findByLabelText('Estado de aprendizaje'),
        ).toBeInTheDocument();

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Ampliar ficha',
            }),
        );

        expect(screen.queryByTestId('tree-canvas')).not.toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: 'Volver al árbol',
            }),
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Volver al árbol',
            }),
        );

        expect(await screen.findByTestId('tree-canvas')).toBeInTheDocument();
        expect(
            screen.queryByLabelText('Estado de aprendizaje'),
        ).not.toBeInTheDocument();
    });

    it('abre la ficha ampliada con doble clic sobre un nodo del canvas', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600900000,
                        },
                        nodes: [
                            buildRootNode(),
                            buildChildNode({
                                id: 102,
                                title: 'Epígrafe 1',
                                siblingOrder: 0,
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 101,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600900000,
                        },
                        selectedNodeContent: {
                            nodeId: 101,
                            note: null,
                            body: '',
                            createdAt: 1713600900000,
                            updatedAt: 1713600900000,
                        },
                    });

                case 'select_node':
                    expect(payload).toEqual({
                        input: {
                            documentId: 1,
                            nodeId: 102,
                        },
                    });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600910000,
                        },
                        nodes: [
                            buildRootNode(),
                            buildChildNode({
                                id: 102,
                                title: 'Epígrafe 1',
                                siblingOrder: 0,
                            }),
                        ],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 102,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600910000,
                        },
                        selectedNodeContent: {
                            nodeId: 102,
                            note: null,
                            body: '',
                            createdAt: 1713600910000,
                            updatedAt: 1713600910000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        fireEvent.click(
            await screen.findByRole('button', {
                name: /Tema 01 · Organización institucional/i,
            }),
        );

        await screen.findByTestId('tree-node-102-button');

        fireEvent.doubleClick(screen.getByTestId('tree-node-102-button'));

        expect(await screen.findByLabelText('Estado de aprendizaje')).toBeInTheDocument();
        expect(screen.queryByTestId('tree-canvas')).not.toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: 'Volver al árbol',
            }),
        ).toBeInTheDocument();
    });

    it('oculta acciones estructurales en la ficha ampliada y mantiene los campos de estudio', async () => {
        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });

                    return buildSnapshot({
                        document: {
                            id: 1,
                            title: 'Tema 01 · Organización institucional',
                            createdAt: 1713600000000,
                            updatedAt: 1713600900000,
                        },
                        nodes: [buildRootNode()],
                        viewState: {
                            documentId: 1,
                            selectedNodeId: 101,
                            panX: 0,
                            panY: 0,
                            zoom: 1,
                            updatedAt: 1713600900000,
                        },
                        selectedNodeContent: {
                            nodeId: 101,
                            note: null,
                            body: '',
                            createdAt: 1713600900000,
                            updatedAt: 1713600900000,
                        },
                    });

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        fireEvent.click(
            await screen.findByRole('button', {
                name: /Tema 01 · Organización institucional/i,
            }),
        );

        await screen.findByRole('heading', {
            name: 'Tema 01 · Organización institucional',
        });

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Vista mixta',
            }),
        );

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Ampliar ficha',
            }),
        );

        expect(screen.queryByLabelText('Nuevo hijo del nodo seleccionado')).not.toBeInTheDocument();
        expect(screen.queryByText('Expandir o colapsar rama')).not.toBeInTheDocument();
        expect(screen.queryByText('Eliminar nodo')).not.toBeInTheDocument();

        expect(screen.getByLabelText('Título del nodo')).toBeInTheDocument();
        expect(screen.getByLabelText('Estado de aprendizaje')).toBeInTheDocument();
        expect(screen.getByLabelText('Nota')).toBeInTheDocument();
        expect(screen.getByLabelText('Contenido')).toBeInTheDocument();
    });


    it('muestra el contenido como editor enriquecido con barra de formato', async () => {
        const currentSnapshot = buildSnapshot({
            document: {
                id: 1,
                title: 'Tema 01 · Organización institucional',
                createdAt: 1713600000000,
                updatedAt: 1713600300000,
            },
            nodes: [buildRootNode(), buildChildNode()],
            viewState: {
                documentId: 1,
                selectedNodeId: 102,
                panX: 0,
                panY: 0,
                zoom: 1,
                updatedAt: 1713600300000,
            },
            selectedNodeContent: {
                nodeId: 102,
                note: 'Nota existente',
                body: '<p><strong>Contenido enriquecido</strong></p>',
                createdAt: 1713600300000,
                updatedAt: 1713600300000,
            },
        });

        mockDocumentsIpc((cmd, payload) => {
            switch (cmd) {
                case 'list_documents':
                    return documentsFixture;

                case 'open_document':
                    expect(payload).toEqual({ documentId: 1 });
                    return currentSnapshot;

                default:
                    throw new Error(`Comando no esperado en test: ${cmd}`);
            }
        });

        render(<App />);

        await openDocumentFromSidebar(/Tema 01 · Organización institucional/i);

        fireEvent.dblClick(await screen.findByTestId('tree-node-102-button'));

        expect(await screen.findByLabelText('Contenido')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Contenido' })).toBeInTheDocument();

        expect(screen.getByLabelText('Negrita')).toBeInTheDocument();
        expect(screen.getByLabelText('Cursiva')).toBeInTheDocument();
        expect(screen.getByLabelText('Subrayado')).toBeInTheDocument();
        expect(screen.getByLabelText('Lista con viñetas')).toBeInTheDocument();
        expect(screen.getByLabelText('Lista numerada')).toBeInTheDocument();
        expect(screen.getByLabelText('Alinear a la izquierda')).toBeInTheDocument();
        expect(screen.getByLabelText('Centrar')).toBeInTheDocument();
        expect(screen.getByLabelText('Alinear a la derecha')).toBeInTheDocument();

        expect(screen.getByText('Contenido enriquecido')).toBeInTheDocument();
    });

});
