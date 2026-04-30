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

function buildCallbacks() {
    return {
        onSelectNode: vi.fn(),
        onOpenDetailsWorkspace: vi.fn(),
        onToggleCollapse: vi.fn(),
        onQuickCreateChild: vi.fn(),
        onQuickDeleteLeaf: vi.fn(),
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

    it('mantiene compacto el primer anillo radial cuando solo necesita separarse del root', () => {
        const callbacks = buildCallbacks();
        const nodes: NodeDto[] = [
            buildNode({
                id: 101,
                parentId: null,
                title: 'Root',
            }),
            buildNode({
                id: 102,
                parentId: 101,
                title: 'Hijo unico',
                siblingOrder: 0,
            }),
        ];

        const result = buildVisualTree({
            nodes,
            rootNodeId: 101,
            selectedNodeId: 101,
            isBusy: false,
            layoutDirection: 'radial',
            ...callbacks,
        });

        const root = result.flowNodes.find((node) => node.id === '101');
        const child = result.flowNodes.find((node) => node.id === '102');

        expect(root).toBeDefined();
        expect(child).toBeDefined();

        const rootCenterX = root!.position.x + 160;
        const rootCenterY = root!.position.y + 76;
        const childCenterX = child!.position.x + 78;
        const childCenterY = child!.position.y + 23;
        const childRadius = Math.hypot(
            childCenterX - rootCenterX,
            childCenterY - rootCenterY,
        );

        expect(childRadius).toBeLessThan(280);
    });

    it('dimensiona el anillo radial por separacion real entre tarjetas vecinas', () => {
        const callbacks = buildCallbacks();
        const childNodes = Array.from({ length: 24 }, (_, index) =>
            buildNode({
                id: 200 + index,
                parentId: 101,
                title: `Hijo ${index + 1}`,
                siblingOrder: index,
            }),
        );

        const result = buildVisualTree({
            nodes: [
                buildNode({
                    id: 101,
                    parentId: null,
                    title: 'Root',
                }),
                ...childNodes,
            ],
            rootNodeId: 101,
            selectedNodeId: 101,
            isBusy: false,
            layoutDirection: 'radial',
            ...callbacks,
        });

        const childBoxes = result.flowNodes
            .filter((node) => node.id !== '101')
            .map((node) => ({
                id: node.id,
                left: node.position.x,
                right: node.position.x + 156,
                top: node.position.y,
                bottom: node.position.y + 46,
            }));

        for (let index = 0; index < childBoxes.length; index += 1) {
            const currentBox = childBoxes[index];

            for (let nextIndex = index + 1; nextIndex < childBoxes.length; nextIndex += 1) {
                const nextBox = childBoxes[nextIndex];
                const overlapsHorizontally =
                    currentBox.left < nextBox.right && currentBox.right > nextBox.left;
                const overlapsVertically =
                    currentBox.top < nextBox.bottom && currentBox.bottom > nextBox.top;

                expect(
                    overlapsHorizontally && overlapsVertically,
                    `${currentBox.id} should not overlap ${nextBox.id}`,
                ).toBe(false);
            }
        }
    });
});
