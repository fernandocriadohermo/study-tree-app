import { describe, expect, it, vi } from 'vitest';
import { buildVisualTree } from './buildVisualTree';
import type { NodeDto } from '../../../shared/documents/contracts';

function buildNode(overrides: Partial<NodeDto>): NodeDto {
    return {
        id: 1,
        documentId: 1,
        parentId: null,
        title: 'Nodo',
        learningStatus: 'sin_ver',
        siblingOrder: 0,
        isCollapsed: false,
        createdAt: 1713600000000,
        updatedAt: 1713600000000,
        ...overrides,
    };
}

describe('buildVisualTree', () => {
    it('genera conectores entre padre e hijo visibles en el modelo del canvas', () => {
        const onSelectNode = vi.fn();
        const onOpenDetailsWorkspace = vi.fn();
        const onToggleCollapse = vi.fn();
        const onQuickCreateChild = vi.fn();
        const onQuickDeleteLeaf = vi.fn();

        const nodes: NodeDto[] = [
            buildNode({
                id: 101,
                parentId: null,
                title: 'Root',
            }),
            buildNode({
                id: 102,
                parentId: 101,
                title: 'Hijo 1',
                siblingOrder: 0,
            }),
            buildNode({
                id: 103,
                parentId: 101,
                title: 'Hijo 2',
                siblingOrder: 1,
            }),
            buildNode({
                id: 104,
                parentId: 102,
                title: 'Nieto',
                siblingOrder: 0,
            }),
        ];

        const result = buildVisualTree({
            nodes,
            rootNodeId: 101,
            selectedNodeId: 102,
            isBusy: false,
            onSelectNode,
            onOpenDetailsWorkspace,
            onToggleCollapse,
            onQuickCreateChild,
            onQuickDeleteLeaf,
        });

        expect(result.flowNodes).toHaveLength(4);
        expect(result.flowEdges).toHaveLength(3);

        expect(result.flowEdges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'edge-101-102',
                    source: '101',
                    target: '102',
                    sourceHandle: 'source',
                    targetHandle: 'target',
                }),
                expect.objectContaining({
                    id: 'edge-101-103',
                    source: '101',
                    target: '103',
                    sourceHandle: 'source',
                    targetHandle: 'target',
                }),
                expect.objectContaining({
                    id: 'edge-102-104',
                    source: '102',
                    target: '104',
                    sourceHandle: 'source',
                    targetHandle: 'target',
                }),
            ]),
        );
    });

    it('no genera conectores hacia descendientes ocultos por colapso', () => {
        const onSelectNode = vi.fn();
        const onOpenDetailsWorkspace = vi.fn();
        const onToggleCollapse = vi.fn();
        const onQuickCreateChild = vi.fn();
        const onQuickDeleteLeaf = vi.fn();

        const nodes: NodeDto[] = [
            buildNode({
                id: 101,
                parentId: null,
                title: 'Root',
            }),
            buildNode({
                id: 102,
                parentId: 101,
                title: 'Hijo colapsado',
                siblingOrder: 0,
                isCollapsed: true,
            }),
            buildNode({
                id: 103,
                parentId: 102,
                title: 'Nieto oculto',
                siblingOrder: 0,
            }),
        ];

        const result = buildVisualTree({
            nodes,
            rootNodeId: 101,
            selectedNodeId: 102,
            isBusy: false,
            onSelectNode,
            onOpenDetailsWorkspace,
            onToggleCollapse,
            onQuickCreateChild,
            onQuickDeleteLeaf,
        });

        expect(result.flowNodes.map((node) => node.id)).toEqual(['101', '102']);
        expect(result.flowEdges).toEqual([
            expect.objectContaining({
                id: 'edge-101-102',
                source: '101',
                target: '102',
            }),
        ]);
    });

    it('marca como activas las conexiones ligadas al nodo seleccionado', () => {
        const onSelectNode = vi.fn();
        const onOpenDetailsWorkspace = vi.fn();
        const onToggleCollapse = vi.fn();
        const onQuickCreateChild = vi.fn();
        const onQuickDeleteLeaf = vi.fn();

        const nodes: NodeDto[] = [
            buildNode({
                id: 101,
                parentId: null,
                title: 'Root',
            }),
            buildNode({
                id: 102,
                parentId: 101,
                title: 'Hijo seleccionado',
                siblingOrder: 0,
            }),
            buildNode({
                id: 103,
                parentId: 101,
                title: 'Hermano',
                siblingOrder: 1,
            }),
            buildNode({
                id: 104,
                parentId: 102,
                title: 'Nieto',
                siblingOrder: 0,
            }),
        ];

        const result = buildVisualTree({
            nodes,
            rootNodeId: 101,
            selectedNodeId: 102,
            isBusy: false,
            onSelectNode,
            onOpenDetailsWorkspace,
            onToggleCollapse,
            onQuickCreateChild,
            onQuickDeleteLeaf,
        });

        expect(result.flowEdges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'edge-101-102',
                    className: 'is-active-connection',
                }),
                expect.objectContaining({
                    id: 'edge-101-103',
                    className: 'is-passive-connection',
                }),
                expect.objectContaining({
                    id: 'edge-102-104',
                    className: 'is-active-connection',
                }),
            ]),
        );
    });

    it('marca como borrable solo a los nodos hoja no root', () => {
        const onSelectNode = vi.fn();
        const onOpenDetailsWorkspace = vi.fn();
        const onToggleCollapse = vi.fn();
        const onQuickCreateChild = vi.fn();
        const onQuickDeleteLeaf = vi.fn();

        const nodes: NodeDto[] = [
            buildNode({
                id: 101,
                parentId: null,
                title: 'Root',
            }),
            buildNode({
                id: 102,
                parentId: 101,
                title: 'Nodo padre',
                siblingOrder: 0,
            }),
            buildNode({
                id: 103,
                parentId: 102,
                title: 'Nodo hoja',
                siblingOrder: 0,
            }),
        ];

        const result = buildVisualTree({
            nodes,
            rootNodeId: 101,
            selectedNodeId: 102,
            isBusy: false,
            onSelectNode,
            onOpenDetailsWorkspace,
            onToggleCollapse,
            onQuickCreateChild,
            onQuickDeleteLeaf,
        });

        const rootNode = result.flowNodes.find((node) => node.id === '101');
        const parentNode = result.flowNodes.find((node) => node.id === '102');
        const leafNode = result.flowNodes.find((node) => node.id === '103');

        expect(rootNode?.data.canDelete).toBe(false);
        expect(parentNode?.data.canDelete).toBe(false);
        expect(leafNode?.data.canDelete).toBe(true);
    });
});