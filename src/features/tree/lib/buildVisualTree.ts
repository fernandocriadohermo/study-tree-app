import { Position, type Edge, type Node } from '@xyflow/react';
import type { NodeDto } from '../../../shared/documents/contracts';

export const VISUAL_NODE_WIDTH = 236;
export const VISUAL_NODE_HEIGHT = 104;

const HORIZONTAL_GAP = 176;
const VERTICAL_GAP = 68;

const VERTICAL_TREE_HORIZONTAL_GAP_MAX = 64;
const VERTICAL_TREE_HORIZONTAL_GAP_MIN = 18;

const VERTICAL_TREE_VERTICAL_GAP_MIN = 96;
const VERTICAL_TREE_VERTICAL_GAP_MAX = 176;

export type VisualTreeLayoutDirection = 'horizontal' | 'vertical';

export type StudyTreeNodeData = Record<string, unknown> & {
    nodeId: number;
    title: string;
    learningStatus: NodeDto['learningStatus'];
    kindLabel: string;
    layoutDirection?: VisualTreeLayoutDirection;
    isActive: boolean;
    isContextual: boolean;
    isBusy: boolean;
    hasChildren: boolean;
    isCollapsed: boolean;
    canDelete: boolean;
    onSelectNode: (nodeId: number) => Promise<void> | void;
    onOpenDetailsWorkspace: (nodeId: number) => Promise<void> | void;
    onToggleCollapse: (nodeId: number, isCollapsed: boolean) => Promise<void> | void;
    onQuickCreateChild: (
        parentNodeId: number,
        parentTitle: string,
    ) => Promise<void> | void;
    onQuickDeleteLeaf: (nodeId: number, title: string) => Promise<void> | void;
    onQuickSetLearningStatus: (
        nodeId: number,
        learningStatus: NodeDto['learningStatus'],
    ) => Promise<void> | void;
};

export type StudyTreeFlowNode = Node<StudyTreeNodeData, 'studyTreeNode'>;

interface BuildVisualTreeInput {
    nodes: NodeDto[];
    rootNodeId: number;
    selectedNodeId: number;
    isBusy: boolean;
    layoutDirection?: VisualTreeLayoutDirection;
    onSelectNode: (nodeId: number) => Promise<void> | void;
    onOpenDetailsWorkspace: (nodeId: number) => Promise<void> | void;
    onToggleCollapse: (nodeId: number, isCollapsed: boolean) => Promise<void> | void;
    onQuickCreateChild: (
        parentNodeId: number,
        parentTitle: string,
    ) => Promise<void> | void;
    onQuickDeleteLeaf: (nodeId: number, title: string) => Promise<void> | void;
    onQuickSetLearningStatus?: (
        nodeId: number,
        learningStatus: NodeDto['learningStatus'],
    ) => Promise<void> | void;
}

function sortBySiblingOrder(nodes: NodeDto[]): NodeDto[] {
    return [...nodes].sort((a, b) => {
        if (a.siblingOrder !== b.siblingOrder) {
            return a.siblingOrder - b.siblingOrder;
        }

        return a.id - b.id;
    });
}

function getKindLabel(depth: number): string {
    if (depth === 0) {
        return 'Root';
    }

    if (depth === 1) {
        return 'Hijo';
    }

    return 'Nieto';
}

function buildChildrenByParentId(nodes: NodeDto[]): Map<number, NodeDto[]> {
    const nextMap = new Map<number, NodeDto[]>();

    for (const node of nodes) {
        if (node.parentId === null) {
            continue;
        }

        const currentChildren = nextMap.get(node.parentId) ?? [];
        currentChildren.push(node);
        nextMap.set(node.parentId, currentChildren);
    }

    for (const [parentId, children] of nextMap.entries()) {
        nextMap.set(parentId, sortBySiblingOrder(children));
    }

    return nextMap;
}

function collectVisibleNodes(
    node: NodeDto,
    childrenByParentId: Map<number, NodeDto[]>,
    output: NodeDto[],
): void {
    output.push(node);

    if (node.isCollapsed) {
        return;
    }

    const children = childrenByParentId.get(node.id) ?? [];

    for (const child of children) {
        collectVisibleNodes(child, childrenByParentId, output);
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function countVisibleLeaves(
    node: NodeDto,
    childrenByParentId: Map<number, NodeDto[]>,
): number {
    if (node.isCollapsed) {
        return 1;
    }

    const children = childrenByParentId.get(node.id) ?? [];

    if (children.length === 0) {
        return 1;
    }

    return children.reduce((total, child) => {
        return total + countVisibleLeaves(child, childrenByParentId);
    }, 0);
}

function getVerticalTreeAdaptiveGaps(visibleLeafCount: number): {
    horizontalGap: number;
    verticalGap: number;
} {
    const pressure = clamp((visibleLeafCount - 8) / 32, 0, 1);

    const horizontalGap =
        VERTICAL_TREE_HORIZONTAL_GAP_MAX -
        (VERTICAL_TREE_HORIZONTAL_GAP_MAX - VERTICAL_TREE_HORIZONTAL_GAP_MIN) * pressure;

    const verticalGap =
        VERTICAL_TREE_VERTICAL_GAP_MIN +
        (VERTICAL_TREE_VERTICAL_GAP_MAX - VERTICAL_TREE_VERTICAL_GAP_MIN) * pressure;

    return {
        horizontalGap: Math.round(horizontalGap),
        verticalGap: Math.round(verticalGap),
    };
}

function layoutVisibleTree(
    node: NodeDto,
    depth: number,
    childrenByParentId: Map<number, NodeDto[]>,
    positions: Map<number, { x: number; y: number; depth: number }>,
    nextRowRef: { value: number },
    layoutDirection: VisualTreeLayoutDirection,
    verticalTreeHorizontalGap: number,
    verticalTreeVerticalGap: number,
): number {
    const visibleChildren = node.isCollapsed
        ? []
        : childrenByParentId.get(node.id) ?? [];

    const levelGap =
        layoutDirection === 'horizontal'
            ? VISUAL_NODE_WIDTH + HORIZONTAL_GAP
            : VISUAL_NODE_HEIGHT + verticalTreeVerticalGap;

    const siblingGap =
        layoutDirection === 'horizontal'
            ? VISUAL_NODE_HEIGHT + VERTICAL_GAP
            : VISUAL_NODE_WIDTH + verticalTreeHorizontalGap;

    if (visibleChildren.length === 0) {
        const siblingAxisPosition = nextRowRef.value * siblingGap;
        const levelAxisPosition = depth * levelGap;

        const x =
            layoutDirection === 'horizontal'
                ? levelAxisPosition
                : siblingAxisPosition;

        const y =
            layoutDirection === 'horizontal'
                ? siblingAxisPosition
                : levelAxisPosition;

        positions.set(node.id, { x, y, depth });
        nextRowRef.value += 1;

        return siblingAxisPosition;
    }

    const childrenCenters = visibleChildren.map((child) =>
        layoutVisibleTree(
            child,
            depth + 1,
            childrenByParentId,
            positions,
            nextRowRef,
            layoutDirection,
            verticalTreeHorizontalGap,
            verticalTreeVerticalGap,
        ),
    );

    const firstCenter = childrenCenters[0] ?? 0;
    const lastCenter = childrenCenters[childrenCenters.length - 1] ?? firstCenter;
    const siblingAxisPosition = (firstCenter + lastCenter) / 2;
    const levelAxisPosition = depth * levelGap;

    const x =
        layoutDirection === 'horizontal'
            ? levelAxisPosition
            : siblingAxisPosition;

    const y =
        layoutDirection === 'horizontal'
            ? siblingAxisPosition
            : levelAxisPosition;

    positions.set(node.id, { x, y, depth });

    return siblingAxisPosition;
}

export function buildVisualTree({
    nodes,
    rootNodeId,
    selectedNodeId,
    isBusy,
    layoutDirection = 'horizontal',
    onSelectNode,
    onOpenDetailsWorkspace,
    onToggleCollapse,
    onQuickCreateChild,
    onQuickDeleteLeaf,
    onQuickSetLearningStatus = async () => { },
}: BuildVisualTreeInput): {
    flowNodes: StudyTreeFlowNode[];
    flowEdges: Edge[];
} {
    const nodesById = new Map<number, NodeDto>();

    for (const node of nodes) {
        nodesById.set(node.id, node);
    }

    const rootNode = nodesById.get(rootNodeId);

    if (!rootNode) {
        return {
            flowNodes: [],
            flowEdges: [],
        };
    }

    const childrenByParentId = buildChildrenByParentId(nodes);

    const positions = new Map<number, { x: number; y: number; depth: number }>();
    const nextRowRef = { value: 0 };

    const visibleLeafCount = countVisibleLeaves(rootNode, childrenByParentId);
    const verticalTreeAdaptiveGaps = getVerticalTreeAdaptiveGaps(visibleLeafCount);

    layoutVisibleTree(
        rootNode,
        0,
        childrenByParentId,
        positions,
        nextRowRef,
        layoutDirection,
        verticalTreeAdaptiveGaps.horizontalGap,
        verticalTreeAdaptiveGaps.verticalGap,
    );

    const visibleNodes: NodeDto[] = [];
    collectVisibleNodes(rootNode, childrenByParentId, visibleNodes);

    const selectedNode = nodesById.get(selectedNodeId) ?? null;

    const flowNodes: StudyTreeFlowNode[] = visibleNodes.map((node) => {
        const position = positions.get(node.id);

        if (!position) {
            throw new Error(`No se pudo calcular la posición visual del nodo ${node.id}`);
        }

        const isActive = selectedNodeId === node.id;
        const isDirectParentOfSelected = selectedNode?.parentId === node.id;
        const isDirectChildOfSelected = node.parentId === selectedNodeId;
        const isContextual = !isActive && (isDirectParentOfSelected || isDirectChildOfSelected);
        const hasChildren = (childrenByParentId.get(node.id) ?? []).length > 0;
        const canDelete = node.parentId !== null && !hasChildren;

        return {
            id: String(node.id),
            type: 'studyTreeNode',
            position: {
                x: position.x,
                y: position.y,
            },
            sourcePosition:
                layoutDirection === 'horizontal' ? Position.Right : Position.Bottom,
            targetPosition:
                layoutDirection === 'horizontal' ? Position.Left : Position.Top,
            draggable: false,
            selectable: false,
            data: {
                nodeId: node.id,
                title: node.title,
                learningStatus: node.learningStatus,
                kindLabel: getKindLabel(position.depth),
                layoutDirection,
                isActive,
                isContextual,
                isBusy,
                hasChildren,
                isCollapsed: node.isCollapsed,
                canDelete,
                onSelectNode,
                onOpenDetailsWorkspace,
                onToggleCollapse,
                onQuickCreateChild,
                onQuickDeleteLeaf,
                onQuickSetLearningStatus,
            },
        };
    });

    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));

    const flowEdges: Edge[] = visibleNodes
        .filter((node) => node.parentId !== null && visibleNodeIds.has(node.parentId))
        .map((node) => {
            const isActiveConnection =
                node.id === selectedNodeId || node.parentId === selectedNodeId;

            return {
                id: `edge-${node.parentId}-${node.id}`,
                source: String(node.parentId),
                target: String(node.id),
                sourceHandle: 'source',
                targetHandle: 'target',
                type: 'bezier',
                className: isActiveConnection
                    ? 'is-active-connection'
                    : 'is-passive-connection',
                selectable: false,
                focusable: false,
                animated: false,
                style: {
                    stroke: 'rgba(96, 165, 250, 0.58)',
                    strokeWidth: 2.5,
                },
                zIndex: 0,
            };
        });

    return {
        flowNodes,
        flowEdges,
    };
}