import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import {
    Background,
    Controls,
    Handle,
    Position,
    ReactFlow,
    useReactFlow,
    type Edge,
    type NodeProps,
    type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { NodeDto, OpenDocumentSnapshotDto } from '../../../shared/documents/contracts';
import {
    buildVisualTree,
    VISUAL_NODE_HEIGHT,
    VISUAL_NODE_WIDTH,
    type StudyTreeFlowNode,
} from '../lib/buildVisualTree';
import { isRectFullyVisibleWithinContainer } from '../lib/selectionVisibility';
import { RichContentEditor } from './RichContentEditor';
import { TreeOutline } from './TreeOutline';

interface RootTreePanelProps {
    snapshot: OpenDocumentSnapshotDto | null;
    isSavingContent: boolean;
    saveErrorMessage: string | null;

    isCreatingChild: boolean;
    isSelectingNodeId: number | null;
    isTogglingCollapseNodeId: number | null;
    isUpdatingLearningStatusNodeId: number | null;
    isRenamingNodeId: number | null;
    isDeletingNodeId: number | null;

    onAutosaveContent: (note: string, body: string) => Promise<void> | void;
    onCreateChildNode: (parentNodeId: number, title: string) => Promise<void> | void;
    onSelectNode: (nodeId: number) => Promise<void> | void;
    onSetNodeCollapsed: (nodeId: number, isCollapsed: boolean) => Promise<void> | void;
    onSetNodeLearningStatus: (
        nodeId: number,
        learningStatus: NodeDto['learningStatus'],
    ) => Promise<void> | void;
    onRenameNode: (nodeId: number, title: string) => Promise<void> | void;
    onDeleteLeafNode: (nodeId: number) => Promise<void> | void;
    isCreatingDocumentFromNodeId: number | null;
    createDocumentFromNodeErrorMessage: string | null;
    onCreateDocumentFromNode: (
        sourceDocumentId: number,
        sourceNodeId: number,
    ) => Promise<void> | void;
    isSavingViewport: boolean;
    onSaveViewport: (
        documentId: number,
        panX: number,
        panY: number,
        zoom: number,
    ) => Promise<void> | void;
    onDetailsMaximizedChange?: (isMaximized: boolean) => void;
}

const AUTOSAVE_DELAY_MS = 800;
const VIEWPORT_SAVE_DELAY_MS = 250;
const SELECTION_VISIBILITY_MARGIN_PX = 28;
const RADIAL_HANDLE_POSITIONS = [
    Position.Top,
    Position.Right,
    Position.Bottom,
    Position.Left,
];
const RADIAL_HANDLE_OFFSETS = [25, 50, 75];
const SEARCH_PREVIEW_RADIUS = 54;

function getRadialHandleStyle(position: Position, offset: number) {
    if (position === Position.Top || position === Position.Bottom) {
        return { left: `${offset}%` };
    }

    return { top: `${offset}%` };
}

function stripHtml(value: string): string {
    return value
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeSearchText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase();
}

function getSearchPreview(text: string, normalizedText: string, normalizedQuery: string): string {
    const matchIndex = normalizedText.indexOf(normalizedQuery);

    if (matchIndex < 0) {
        return text;
    }

    const start = Math.max(0, matchIndex - SEARCH_PREVIEW_RADIUS);
    const end = Math.min(text.length, matchIndex + normalizedQuery.length + SEARCH_PREVIEW_RADIUS);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';

    return `${prefix}${text.slice(start, end)}${suffix}`;
}

function renderHighlightedText(text: string, query: string): ReactNode {
    const normalizedQuery = normalizeSearchText(query.trim());

    if (!normalizedQuery) {
        return text;
    }

    const normalizedText = normalizeSearchText(text);
    const parts: ReactNode[] = [];
    let searchFrom = 0;
    let key = 0;

    while (searchFrom < text.length) {
        const matchIndex = normalizedText.indexOf(normalizedQuery, searchFrom);

        if (matchIndex < 0) {
            parts.push(text.slice(searchFrom));
            break;
        }

        if (matchIndex > searchFrom) {
            parts.push(text.slice(searchFrom, matchIndex));
        }

        const matchEnd = matchIndex + normalizedQuery.length;
        parts.push(
            <mark key={key} className="search-highlight">
                {text.slice(matchIndex, matchEnd)}
            </mark>,
        );
        key += 1;
        searchFrom = matchEnd;
    }

    return parts;
}

function isSameViewport(a: Viewport, b: Viewport): boolean {
    return (
        Math.abs(a.x - b.x) < 0.5 &&
        Math.abs(a.y - b.y) < 0.5 &&
        Math.abs(a.zoom - b.zoom) < 0.01
    );
}

const LEARNING_STATUS_OPTIONS: Array<{
    value: NodeDto['learningStatus'];
    label: string;
}> = [
        { value: 'sin_ver', label: 'Sin ver' },
        { value: 'visto', label: 'Visto' },
        { value: 'en_estudio', label: 'En estudio' },
        { value: 'dominado', label: 'Dominado' },
    ];





function QuickCreateChildIcon() {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="quick-node-action__icon">
            <path
                d="M8 3.25a.75.75 0 0 1 .75.75v3.25H12a.75.75 0 0 1 0 1.5H8.75V12a.75.75 0 0 1-1.5 0V8.75H4a.75.75 0 0 1 0-1.5h3.25V4A.75.75 0 0 1 8 3.25Z"
                fill="currentColor"
            />
        </svg>
    );
}

function QuickDeleteLeafIcon() {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="quick-node-action__icon">
            <path
                d="M6 2.75A1.75 1.75 0 0 0 4.25 4.5v.25H2.75a.75.75 0 0 0 0 1.5h.53l.56 6.13A1.75 1.75 0 0 0 5.58 14h4.84a1.75 1.75 0 0 0 1.74-1.62l.56-6.13h.53a.75.75 0 0 0 0-1.5h-1.5V4.5A1.75 1.75 0 0 0 10 2.75H6Zm4.25 2H5.75V4.5A.25.25 0 0 1 6 4.25h4a.25.25 0 0 1 .25.25v.25Zm-3 2.25a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5a.75.75 0 0 1 .75-.75Zm2.5 0a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5a.75.75 0 0 1 .75-.75Z"
                fill="currentColor"
            />
        </svg>
    );
}

function sortBySiblingOrder(nodes: NodeDto[]): NodeDto[] {
    return [...nodes].sort((a, b) => {
        if (a.siblingOrder !== b.siblingOrder) {
            return a.siblingOrder - b.siblingOrder;
        }

        return a.id - b.id;
    });
}

function getNodeKindLabel(depth: number): string {
    if (depth === 0) {
        return 'Raíz';
    }

    return `Nivel ${depth}`;
}

function getNodeDepth(node: NodeDto, nodesById: Map<number, NodeDto>): number {
    let depth = 0;
    let current: NodeDto | undefined = node;

    while (current.parentId !== null) {
        const parent = nodesById.get(current.parentId);

        if (!parent) {
            break;
        }

        depth += 1;
        current = parent;

        if (depth > 100) {
            break;
        }
    }

    return depth;
}

function getNodePathTitles(
    node: NodeDto,
    nodesById: Map<number, NodeDto>,
): string[] {
    const titles: string[] = [];
    let current: NodeDto | undefined = node;
    let guard = 0;

    while (current) {
        titles.push(current.title);

        if (current.parentId === null) {
            break;
        }

        current = nodesById.get(current.parentId);
        guard += 1;

        if (guard > 100) {
            break;
        }
    }

    return titles.reverse();
}

function getNodePathNodes(
    node: NodeDto,
    nodesById: Map<number, NodeDto>,
): NodeDto[] {
    const pathNodes: NodeDto[] = [];
    let current: NodeDto | undefined = node;
    let guard = 0;

    while (current) {
        pathNodes.push(current);

        if (current.parentId === null) {
            break;
        }

        current = nodesById.get(current.parentId);
        guard += 1;

        if (guard > 100) {
            break;
        }
    }

    return pathNodes.reverse();
}

function isTreeBusy(
    isSavingContent: boolean,
    isCreatingChild: boolean,
    isSelectingNodeId: number | null,
    isTogglingCollapseNodeId: number | null,
    isUpdatingLearningStatusNodeId: number | null,
    isRenamingNodeId: number | null,
    isDeletingNodeId: number | null,
): boolean {
    return (
        isSavingContent ||
        isCreatingChild ||
        isSelectingNodeId !== null ||
        isTogglingCollapseNodeId !== null ||
        isUpdatingLearningStatusNodeId !== null ||
        isRenamingNodeId !== null ||
        isDeletingNodeId !== null
    );
}

type TreeVisibilityMode = 'free' | 'expanded' | 'collapsed' | 'focus';

function getNodePathIds(
    node: NodeDto,
    nodesById: Map<number, NodeDto>,
): number[] {
    const pathIds: number[] = [];
    let current: NodeDto | undefined = node;
    let guard = 0;

    while (current) {
        pathIds.push(current.id);

        if (current.parentId === null) {
            break;
        }

        current = nodesById.get(current.parentId);
        guard += 1;

        if (guard > 1000) {
            break;
        }
    }

    return pathIds.reverse();
}

function getFocusVisibleNodeIds(
    rootNodeId: number,
    selectedNodeId: number,
    nodesById: Map<number, NodeDto>,
    childrenByParentId: Map<number, NodeDto[]>,
): Set<number> {
    const visibleNodeIds = new Set<number>();
    const rootNode = nodesById.get(rootNodeId);
    const selectedNode = nodesById.get(selectedNodeId) ?? rootNode;

    if (!rootNode || !selectedNode) {
        return visibleNodeIds;
    }

    const pathIds = getNodePathIds(selectedNode, nodesById);

    for (const pathNodeId of pathIds) {
        visibleNodeIds.add(pathNodeId);

        const pathNodeChildren = childrenByParentId.get(pathNodeId) ?? [];

        for (const childNode of pathNodeChildren) {
            visibleNodeIds.add(childNode.id);
        }
    }

    if (selectedNode.parentId !== null) {
        const siblingNodes = childrenByParentId.get(selectedNode.parentId) ?? [];

        for (const siblingNode of siblingNodes) {
            visibleNodeIds.add(siblingNode.id);
        }
    }

    const selectedNodeChildren = childrenByParentId.get(selectedNode.id) ?? [];

    for (const childNode of selectedNodeChildren) {
        visibleNodeIds.add(childNode.id);
    }

    return visibleNodeIds;
}

function getFocusExpandedNodeIds(
    rootNodeId: number,
    selectedNodeId: number,
    nodesById: Map<number, NodeDto>,
): Set<number> {
    const expandedNodeIds = new Set<number>();
    const rootNode = nodesById.get(rootNodeId);
    const selectedNode = nodesById.get(selectedNodeId) ?? rootNode;

    if (!rootNode || !selectedNode) {
        return expandedNodeIds;
    }

    const pathIds = getNodePathIds(selectedNode, nodesById);

    for (const pathNodeId of pathIds) {
        expandedNodeIds.add(pathNodeId);
    }

    expandedNodeIds.add(selectedNode.id);

    return expandedNodeIds;
}

function buildVisualModeNodes(
    nodes: NodeDto[],
    rootNodeId: number,
    selectedNodeId: number,
    treeVisibilityMode: TreeVisibilityMode,
    nodesById: Map<number, NodeDto>,
    childrenByParentId: Map<number, NodeDto[]>,
    searchMatchNodeIds?: Set<number>,
): NodeDto[] {
    const searchExpandedNodeIds = new Set<number>();

    for (const nodeId of searchMatchNodeIds ?? []) {
        const node = nodesById.get(nodeId);

        if (!node) {
            continue;
        }

        const pathIds = getNodePathIds(node, nodesById);

        for (const pathNodeId of pathIds) {
            searchExpandedNodeIds.add(pathNodeId);
        }
    }

    const applySearchExpansion = (visualNodes: NodeDto[]): NodeDto[] => {
        if (searchExpandedNodeIds.size === 0) {
            return visualNodes;
        }

        return visualNodes.map((node) => (
            searchExpandedNodeIds.has(node.id)
                ? {
                    ...node,
                    isCollapsed: false,
                }
                : node
        ));
    };

    if (treeVisibilityMode === 'free') {
        return applySearchExpansion(nodes);
    }

    if (treeVisibilityMode === 'expanded') {
        return nodes.map((node) => ({
            ...node,
            isCollapsed: false,
        }));
    }

    if (treeVisibilityMode === 'collapsed') {
        return applySearchExpansion(nodes.map((node) => ({
            ...node,
            isCollapsed: node.id !== rootNodeId,
        })));
    }

    const focusVisibleNodeIds = getFocusVisibleNodeIds(
        rootNodeId,
        selectedNodeId,
        nodesById,
        childrenByParentId,
    );

    const focusExpandedNodeIds = getFocusExpandedNodeIds(
        rootNodeId,
        selectedNodeId,
        nodesById,
    );

    for (const searchExpandedNodeId of searchExpandedNodeIds) {
        focusVisibleNodeIds.add(searchExpandedNodeId);
    }

    const focusNodes = nodes
        .filter((node) => focusVisibleNodeIds.has(node.id))
        .map((node) => ({
            ...node,
            isCollapsed: !focusExpandedNodeIds.has(node.id),
        }));

    return applySearchExpansion(focusNodes);
}



function StudyTreeCanvasNode({
    data,
}: NodeProps<StudyTreeFlowNode>) {
    const isVerticalLayout = data.layoutDirection === 'vertical';
    const isRadialLayout = data.layoutDirection === 'radial';
    const isCompactLayout = data.isCompactLayout ?? isRadialLayout;
    const isRootNode = data.kindLabel === 'Raíz';

    const targetHandlePosition = isRadialLayout
        ? data.targetHandlePosition ?? Position.Left
        : isVerticalLayout
            ? Position.Top
            : Position.Left;

    const sourceHandlePosition = isRadialLayout
        ? data.sourceHandlePosition ?? Position.Right
        : isVerticalLayout
            ? Position.Bottom
            : Position.Right;

    const showExternalNodeControls = !isRadialLayout;
    const showInlineRadialControls = isRadialLayout && data.isActive;

    return (
        <div
            className={`visual-tree-node-shell nodrag nopan${isRadialLayout ? ' visual-tree-node-shell--radial' : ''}${isCompactLayout ? ' visual-tree-node-shell--compact' : ''}${isRootNode ? ' visual-tree-node-shell--root' : ''}${data.isActive ? ' is-selected' : ''}${data.isContextual ? ' is-contextual' : ''}${data.isSearchMatch ? ' is-search-match' : ''}${data.isActive && data.isSearchMatch ? ' is-search-active' : ''}`}
        >
            {isRadialLayout ? (
                <>
                    {RADIAL_HANDLE_POSITIONS.flatMap((position) =>
                        RADIAL_HANDLE_OFFSETS.map((offset, index) => (
                            <Handle
                                key={`target-${position}-${index}`}
                                id={`target-${position}-${index}`}
                                type="target"
                                position={position}
                                isConnectable={false}
                                style={getRadialHandleStyle(position, offset)}
                                className="visual-tree-node-handle visual-tree-node-handle--radial"
                            />
                        )),
                    )}

                    {RADIAL_HANDLE_POSITIONS.flatMap((position) =>
                        RADIAL_HANDLE_OFFSETS.map((offset, index) => (
                            <Handle
                                key={`source-${position}-${index}`}
                                id={`source-${position}-${index}`}
                                type="source"
                                position={position}
                                isConnectable={false}
                                style={getRadialHandleStyle(position, offset)}
                                className="visual-tree-node-handle visual-tree-node-handle--radial"
                            />
                        )),
                    )}
                </>
            ) : (
                <>
                    <Handle
                        id="target"
                        type="target"
                        position={targetHandlePosition}
                        isConnectable={false}
                        className={`visual-tree-node-handle ${isVerticalLayout
                            ? 'visual-tree-node-handle--target-vertical'
                            : 'visual-tree-node-handle--target'
                            }`}
                    />

                    <Handle
                        id="source"
                        type="source"
                        position={sourceHandlePosition}
                        isConnectable={false}
                        className={`visual-tree-node-handle ${isVerticalLayout
                            ? 'visual-tree-node-handle--source-vertical'
                            : 'visual-tree-node-handle--source'
                            }`}
                    />
                </>
            )}

            {showExternalNodeControls && data.hasChildren ? (
                <button
                    type="button"
                    className={`root-tree-node__branch-toggle nodrag nopan${data.isCollapsed ? ' is-collapsed' : ' is-expanded'}`}
                    onPointerDown={(event) => {
                        event.stopPropagation();
                    }}
                    onDoubleClick={(event) => {
                        event.stopPropagation();
                    }}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void data.onToggleCollapse(data.nodeId, !data.isCollapsed);
                    }}
                    disabled={data.isBusy}
                    data-testid={`tree-node-${data.nodeId}-collapse-badge`}
                    aria-label={data.isCollapsed ? 'Expandir rama' : 'Colapsar rama'}
                    title={data.isCollapsed ? 'Expandir rama' : 'Colapsar rama'}
                >
                    {data.isCollapsed ? '+ rama' : '− rama'}
                </button>
            ) : null}

            {showExternalNodeControls ? (
                <div className="root-tree-node__quick-actions nodrag nopan">
                    <button
                        type="button"
                        className="root-tree-node__quick-action root-tree-node__quick-action--create nodrag nopan"
                        onPointerDown={(event) => {
                            event.stopPropagation();
                        }}
                        onDoubleClick={(event) => {
                            event.stopPropagation();
                        }}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void data.onQuickCreateChild(data.nodeId, data.title);
                        }}
                        disabled={data.isBusy}
                        data-testid={`tree-node-${data.nodeId}-quick-create`}
                        aria-label={`Crear hijo en ${data.title}`}
                        title="Crear hijo"
                    >
                        <QuickCreateChildIcon />
                    </button>

                    {data.canDelete ? (
                        <button
                            type="button"
                            className="root-tree-node__quick-action root-tree-node__quick-action--delete nodrag nopan"
                            onPointerDown={(event) => {
                                event.stopPropagation();
                            }}
                            onDoubleClick={(event) => {
                                event.stopPropagation();
                            }}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void data.onQuickDeleteLeaf(data.nodeId, data.title);
                            }}
                            disabled={data.isBusy}
                            data-testid={`tree-node-${data.nodeId}-quick-delete`}
                            aria-label={`Eliminar ${data.title}`}
                            title="Eliminar nodo hoja"
                        >
                            <QuickDeleteLeafIcon />
                        </button>
                    ) : null}
                </div>
            ) : null}

            <div
                role="button"
                tabIndex={data.isBusy ? -1 : 0}
                className={`visual-tree-node-button nodrag nopan${isRadialLayout ? ' visual-tree-node-button--radial' : ''}${isRootNode ? ' visual-tree-node-button--root' : ''}${data.isActive ? ' is-active' : ''}${data.isContextual ? ' is-contextual' : ''}`}
                onPointerDown={(event) => {
                    event.stopPropagation();
                }}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    if (data.isBusy) {
                        return;
                    }

                    void data.onSelectNode(data.nodeId);
                }}
                onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    if (data.isBusy) {
                        return;
                    }

                    void data.onOpenDetailsWorkspace(data.nodeId);
                }}
                onKeyDown={(event) => {
                    if (data.isBusy) {
                        return;
                    }

                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        void data.onSelectNode(data.nodeId);
                    }
                }}
                data-testid={`tree-node-${data.nodeId}-button`}
                aria-label={data.title}
                aria-disabled={data.isBusy ? 'true' : 'false'}
                title={isRadialLayout && !isRootNode ? data.title : undefined}
            >
                <div
                    className={`root-tree-node nodrag nopan root-tree-node--${data.learningStatus}${isRadialLayout ? ' root-tree-node--radial' : ''}${isRootNode ? ' root-tree-node--root' : ''}${data.isActive ? ' is-selected' : ''}${data.isSearchMatch ? ' is-search-match' : ''}${data.isActive && data.isSearchMatch ? ' is-search-active' : ''}`}
                    data-testid={data.kindLabel === 'Raíz' ? 'root-tree-node' : undefined}
                    data-selected={data.isActive ? 'true' : 'false'}
                >

                    <div className="root-tree-node__eyebrow">{data.kindLabel}</div>
                    <div className="root-tree-node__title">{data.title}</div>
                    {showInlineRadialControls ? (
                        <div className="root-tree-node__inline-controls nodrag nopan">
                            {data.hasChildren ? (
                                <button
                                    type="button"
                                    className={`root-tree-node__inline-branch-toggle${data.isCollapsed ? ' is-collapsed' : ' is-expanded'}`}
                                    onPointerDown={(event) => {
                                        event.stopPropagation();
                                    }}
                                    onDoubleClick={(event) => {
                                        event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        void data.onToggleCollapse(data.nodeId, !data.isCollapsed);
                                    }}
                                    disabled={data.isBusy}
                                    data-testid={`tree-node-${data.nodeId}-collapse-badge`}
                                    aria-label={data.isCollapsed ? 'Expandir rama' : 'Colapsar rama'}
                                    title={data.isCollapsed ? 'Expandir rama' : 'Colapsar rama'}
                                >
                                    {data.isCollapsed ? '+ rama' : '− rama'}
                                </button>
                            ) : null}

                            <button
                                type="button"
                                className="root-tree-node__inline-action root-tree-node__inline-action--create"
                                onPointerDown={(event) => {
                                    event.stopPropagation();
                                }}
                                onDoubleClick={(event) => {
                                    event.stopPropagation();
                                }}
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void data.onQuickCreateChild(data.nodeId, data.title);
                                }}
                                disabled={data.isBusy}
                                data-testid={`tree-node-${data.nodeId}-quick-create`}
                                aria-label={`Crear hijo en ${data.title}`}
                                title="Crear hijo"
                            >
                                <QuickCreateChildIcon />
                            </button>

                            {data.canDelete ? (
                                <button
                                    type="button"
                                    className="root-tree-node__inline-action root-tree-node__inline-action--delete"
                                    onPointerDown={(event) => {
                                        event.stopPropagation();
                                    }}
                                    onDoubleClick={(event) => {
                                        event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        void data.onQuickDeleteLeaf(data.nodeId, data.title);
                                    }}
                                    disabled={data.isBusy}
                                    data-testid={`tree-node-${data.nodeId}-quick-delete`}
                                    aria-label={`Eliminar ${data.title}`}
                                    title="Eliminar nodo hoja"
                                >
                                    <QuickDeleteLeafIcon />
                                </button>
                            ) : null}
                        </div>
                    ) : null}

                    {data.isActive && !data.hasChildren ? (
                        <div className="root-tree-node__quick-status-wrap nodrag nopan">
                            <select
                                className={`root-tree-node__quick-status-select root-tree-node__quick-status-select--${data.learningStatus}`}
                                value={data.learningStatus}
                                onPointerDown={(event) => {
                                    event.stopPropagation();
                                }}
                                onDoubleClick={(event) => {
                                    event.stopPropagation();
                                }}
                                onClick={(event) => {
                                    event.stopPropagation();
                                }}
                                onChange={(event) => {
                                    event.stopPropagation();

                                    const nextLearningStatus =
                                        event.target.value as NodeDto['learningStatus'];

                                    void data.onQuickSetLearningStatus(
                                        data.nodeId,
                                        nextLearningStatus,
                                    );
                                }}
                                disabled={data.isBusy}
                                data-testid={`tree-node-${data.nodeId}-quick-status-select`}
                                aria-label={`Estado de aprendizaje de ${data.title}`}
                                title="Cambiar estado"
                            >
                                {LEARNING_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="root-tree-node__status">{data.learningStatus}</div>
                    )}
                </div>
            </div>
        </div>
    );
}

const nodeTypes = {
    studyTreeNode: StudyTreeCanvasNode,
};

interface CanvasNodeActionsProps {
    selectedNodeTitle: string;
    isBusy: boolean;
    isCreatingDocumentFromNode: boolean;
    errorMessage: string | null;
    onCreateDocumentFromSelectedNode: () => Promise<void> | void;
}

function CanvasNodeActions({
    selectedNodeTitle,
    isBusy,
    isCreatingDocumentFromNode,
    errorMessage,
    onCreateDocumentFromSelectedNode,
}: CanvasNodeActionsProps) {
    return (
        <div className="tree-canvas-node-actions nodrag nopan">
            <button
                type="button"
                className="tree-canvas-node-actions__button nodrag nopan"
                onPointerDown={(event) => {
                    event.stopPropagation();
                }}
                onDoubleClick={(event) => {
                    event.stopPropagation();
                }}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void onCreateDocumentFromSelectedNode();
                }}
                disabled={isBusy}
                title={`Crear documento desde "${selectedNodeTitle}"`}
            >
                {isCreatingDocumentFromNode
                    ? 'Creando documento…'
                    : 'Crear doc desde nodo'}
            </button>

            {errorMessage ? (
                <div className="tree-canvas-node-actions__error">
                    {errorMessage}
                </div>
            ) : null}
        </div>
    );
}

interface ViewportPersistenceBridgeProps {
    documentId: number;
    initialViewport: Viewport;
}

function ViewportPersistenceBridge({
    documentId,
    initialViewport,
}: ViewportPersistenceBridgeProps) {
    const { setViewport } = useReactFlow();
    const appliedDocumentIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (appliedDocumentIdRef.current === documentId) {
            return;
        }

        appliedDocumentIdRef.current = documentId;
        void setViewport(initialViewport, { duration: 0 });
    }, [
        documentId,
        initialViewport.x,
        initialViewport.y,
        initialViewport.zoom,
        setViewport,
    ]);

    return null;
}

interface SelectionVisibilityBridgeProps {
    documentId: number;
    selectedNodeId: number;
    layoutSignature: string;
    canvasContainerRef: React.RefObject<HTMLDivElement | null>;
}

function SelectionVisibilityBridge({
    documentId,
    selectedNodeId,
    layoutSignature,
    canvasContainerRef,
}: SelectionVisibilityBridgeProps) {
    const { getNode, getViewport, setCenter } = useReactFlow<
        StudyTreeFlowNode,
        Edge
    >();

    useEffect(() => {
        let firstFrameId = 0;
        let secondFrameId = 0;

        firstFrameId = window.requestAnimationFrame(() => {
            secondFrameId = window.requestAnimationFrame(() => {
                const canvasContainer = canvasContainerRef.current;

                if (!canvasContainer) {
                    return;
                }

                const nodeButton = canvasContainer.querySelector(
                    `[data-testid="tree-node-${selectedNodeId}-button"]`,
                ) as HTMLElement | null;

                const nodeCard = nodeButton?.querySelector(
                    '.root-tree-node',
                ) as HTMLElement | null;

                if (!nodeCard) {
                    return;
                }

                const canvasRect = canvasContainer.getBoundingClientRect();
                const nodeRect = nodeCard.getBoundingClientRect();

                if (
                    isRectFullyVisibleWithinContainer(
                        nodeRect,
                        canvasRect,
                        SELECTION_VISIBILITY_MARGIN_PX,
                    )
                ) {
                    return;
                }

                const flowNode = getNode(String(selectedNodeId));

                if (!flowNode) {
                    return;
                }

                const currentViewport = getViewport();

                void setCenter(
                    flowNode.position.x + VISUAL_NODE_WIDTH / 2,
                    flowNode.position.y + VISUAL_NODE_HEIGHT / 2,
                    {
                        zoom: currentViewport.zoom,
                        duration: 180,
                    },
                );
            });
        });

        return () => {
            window.cancelAnimationFrame(firstFrameId);
            window.cancelAnimationFrame(secondFrameId);
        };
    }, [
        canvasContainerRef,
        documentId,
        getNode,
        getViewport,
        layoutSignature,
        selectedNodeId,
        setCenter,
    ]);

    return null;
}

interface TreeViewFocusBridgeProps {
    focusNodeId: number;
    focusKey: string;
    zoom?: number;
    duration?: number;
}

function TreeViewFocusBridge({
    focusNodeId,
    focusKey,
    zoom = 0.85,
    duration = 180,
}: TreeViewFocusBridgeProps) {
    const { getNode, setCenter } = useReactFlow<StudyTreeFlowNode, Edge>();

    useEffect(() => {
        let firstFrameId = 0;
        let secondFrameId = 0;

        firstFrameId = window.requestAnimationFrame(() => {
            secondFrameId = window.requestAnimationFrame(() => {
                const flowNode = getNode(String(focusNodeId));

                if (!flowNode) {
                    return;
                }

                void setCenter(
                    flowNode.position.x + VISUAL_NODE_WIDTH / 2,
                    flowNode.position.y + VISUAL_NODE_HEIGHT / 2,
                    {
                        zoom,
                        duration,
                    },
                );
            });
        });

        return () => {
            window.cancelAnimationFrame(firstFrameId);
            window.cancelAnimationFrame(secondFrameId);
        };
    }, [focusKey, focusNodeId, getNode, setCenter, zoom, duration]);

    return null;
}




export function RootTreePanel({
    snapshot,
    isSavingContent,
    saveErrorMessage,
    isCreatingChild,
    isSelectingNodeId,
    isTogglingCollapseNodeId,
    isUpdatingLearningStatusNodeId,
    isRenamingNodeId,
    isDeletingNodeId,
    isCreatingDocumentFromNodeId,
    createDocumentFromNodeErrorMessage,
    isSavingViewport,

    onSaveViewport,
    onAutosaveContent,
    onCreateChildNode,
    onSelectNode,
    onSetNodeCollapsed,
    onSetNodeLearningStatus,
    onRenameNode,
    onDeleteLeafNode,
    onCreateDocumentFromNode,
    onDetailsMaximizedChange,
}: RootTreePanelProps) {
    const [draftTitle, setDraftTitle] = useState('');
    const [draftNote, setDraftNote] = useState('');
    const [draftBody, setDraftBody] = useState('');
    const [newChildTitle, setNewChildTitle] = useState('');
    const [isCanvasMaximized, setIsCanvasMaximized] = useState(true);
    const [isDetailsMaximized, setIsDetailsMaximized] = useState(false);
    const [treeViewMode, setTreeViewMode] = useState<'horizontal' | 'vertical' | 'radial' | 'outline'>('horizontal');
    const [treeVisibilityMode, setTreeVisibilityMode] = useState<TreeVisibilityMode>('free');
    const [nodeSearchQuery, setNodeSearchQuery] = useState('');
    const [searchFocusKey, setSearchFocusKey] = useState(0);

    const selectedContent = snapshot?.selectedNodeContent ?? null;
    const nodes = snapshot?.nodes ?? [];
    const nodeContents = snapshot?.nodeContents ?? [];

    const nodesById = useMemo(() => {
        const nextMap = new Map<number, NodeDto>();

        for (const node of nodes) {
            nextMap.set(node.id, node);
        }

        return nextMap;
    }, [nodes]);

    const childrenByParentId = useMemo(() => {
        const nextMap = new Map<number, NodeDto[]>();

        for (const node of nodes) {
            if (node.parentId === null) {
                continue;
            }

            const currentChildren = nextMap.get(node.parentId) ?? [];
            currentChildren.push(node);
            nextMap.set(node.parentId, currentChildren);
        }

        for (const [parentId, childNodes] of nextMap.entries()) {
            nextMap.set(parentId, sortBySiblingOrder(childNodes));
        }

        return nextMap;
    }, [nodes]);

    const rootNode = useMemo(() => {
        if (!snapshot) {
            return null;
        }

        return nodes.find((node) => node.id === snapshot.rootNodeId) ?? null;
    }, [snapshot, nodes]);

    const selectedNodeId = snapshot
        ? (snapshot.viewState.selectedNodeId ?? snapshot.rootNodeId)
        : null;

    const selectedNode = useMemo(() => {
        if (selectedNodeId === null) {
            return null;
        }

        return nodesById.get(selectedNodeId) ?? rootNode;
    }, [selectedNodeId, nodesById, rootNode]);

    const selectedNodeHasChildren = useMemo(() => {
        if (!selectedNode) {
            return false;
        }

        return (childrenByParentId.get(selectedNode.id) ?? []).length > 0;
    }, [childrenByParentId, selectedNode]);

    const isSelectedNodeLearningStatusEditable = !selectedNodeHasChildren;

    useEffect(() => {
        setDraftTitle(selectedNode?.title ?? '');
    }, [selectedNode?.id, selectedNode?.updatedAt, selectedNode?.title]);

    useEffect(() => {
        onDetailsMaximizedChange?.(isDetailsMaximized);
    }, [isDetailsMaximized, onDetailsMaximizedChange]);

    useEffect(() => {
        setDraftNote(selectedContent?.note ?? '');
        setDraftBody(selectedContent?.body ?? '');
    }, [selectedContent?.nodeId, selectedContent?.updatedAt]);

    const originalTitle = selectedNode?.title ?? '';
    const originalNote = selectedContent?.note ?? '';
    const originalBody = selectedContent?.body ?? '';
    const normalizedNodeSearchQuery = useMemo(
        () => normalizeSearchText(nodeSearchQuery.trim()),
        [nodeSearchQuery],
    );
    const nodeContentsById = useMemo(() => {
        const nextMap = new Map<number, { note: string; body: string }>();

        for (const content of nodeContents) {
            nextMap.set(content.nodeId, {
                note: content.note ?? '',
                body: content.body,
            });
        }

        if (selectedContent) {
            nextMap.set(selectedContent.nodeId, {
                note: draftNote,
                body: draftBody,
            });
        }

        return nextMap;
    }, [nodeContents, selectedContent, draftNote, draftBody]);
    const searchResults = useMemo(() => {
        if (!normalizedNodeSearchQuery) {
            return [];
        }

        return nodes
            .filter((node) => node.id !== snapshot?.rootNodeId)
            .map((node) => {
                const content = nodeContentsById.get(node.id) ?? { note: '', body: '' };
                const title = node.id === selectedNode?.id ? draftTitle : node.title;
                const note = content.note;
                const body = stripHtml(content.body);
                const normalizedTitle = normalizeSearchText(title);
                const normalizedNote = normalizeSearchText(note);
                const normalizedBody = normalizeSearchText(body);
                const fields: Array<{
                    key: 'title' | 'note' | 'body';
                    label: string;
                    text: string;
                    normalizedText: string;
                }> = [
                        {
                            key: 'title',
                            label: 'Titulo',
                            text: title,
                            normalizedText: normalizedTitle,
                        },
                        {
                            key: 'note',
                            label: 'Nota',
                            text: note,
                            normalizedText: normalizedNote,
                        },
                        {
                            key: 'body',
                            label: 'Contenido',
                            text: body,
                            normalizedText: normalizedBody,
                        },
                    ];
                const matchedFields = fields
                    .filter((field) => field.normalizedText.includes(normalizedNodeSearchQuery))
                    .map((field) => ({
                        key: field.key,
                        label: field.label,
                        preview: getSearchPreview(
                            field.text,
                            field.normalizedText,
                            normalizedNodeSearchQuery,
                        ),
                    }));

                return matchedFields.length > 0
                    ? {
                        node,
                        matchedFields,
                    }
                    : null;
            })
            .filter((result): result is {
                node: NodeDto;
                matchedFields: Array<{
                    key: 'title' | 'note' | 'body';
                    label: string;
                    preview: string;
                }>;
            } => result !== null);
    }, [
        nodes,
        nodeContentsById,
        normalizedNodeSearchQuery,
        snapshot?.rootNodeId,
        selectedNode?.id,
        draftTitle,
    ]);
    const searchMatchNodeIds = useMemo(
        () => new Set(searchResults.map((result) => result.node.id)),
        [searchResults],
    );
    const selectedNodeSearchResult = selectedNode
        ? searchResults.find((result) => result.node.id === selectedNode.id) ?? null
        : null;

    const normalizedDraftTitle = draftTitle.trim();
    const isTitleDirty =
        normalizedDraftTitle.length > 0 && normalizedDraftTitle !== originalTitle;
    const isContentDirty = draftNote !== originalNote || draftBody !== originalBody;
    const hasPendingChanges = isTitleDirty || isContentDirty;

    useEffect(() => {
        if (!selectedContent) {
            return;
        }

        if (isSavingContent || isRenamingNodeId !== null || isDeletingNodeId !== null) {
            return;
        }

        if (!isContentDirty) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            void onAutosaveContent(draftNote, draftBody);
        }, AUTOSAVE_DELAY_MS);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [
        selectedContent,
        draftNote,
        draftBody,
        isContentDirty,
        isSavingContent,
        isRenamingNodeId,
        isDeletingNodeId,
        onAutosaveContent,
    ]);

    const treeBusy = isTreeBusy(
        isSavingContent,
        isCreatingChild,
        isSelectingNodeId,
        isTogglingCollapseNodeId,
        isUpdatingLearningStatusNodeId,
        isRenamingNodeId,
        isDeletingNodeId,
    ) || isCreatingDocumentFromNodeId !== null;



    const persistPendingChanges = async () => {
        if (isTitleDirty && selectedNode) {
            await onRenameNode(selectedNode.id, normalizedDraftTitle);
        }

        if (isContentDirty && selectedContent) {
            await onAutosaveContent(draftNote, draftBody);
        }
    };

    const handleSelectNodeFromCanvas = async (nodeId: number) => {
        if (nodeId === selectedNodeId) {
            return;
        }

        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        await onSelectNode(nodeId);
    };

    const handleOpenDetailsWorkspaceFromCanvas = async (nodeId: number) => {
        if (treeBusy) {
            return;
        }

        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        if (selectedNodeId !== nodeId) {
            await onSelectNode(nodeId);
        }

        showDetailsWorkspace();
    };

    const handleGoToSearchResult = async (direction: 'next' | 'previous') => {
        if (searchResults.length === 0 || treeBusy) {
            return;
        }

        const currentIndex = selectedNodeId === null
            ? -1
            : searchResults.findIndex((result) => result.node.id === selectedNodeId);
        const fallbackIndex = direction === 'next'
            ? 0
            : searchResults.length - 1;
        const nextIndex = currentIndex < 0
            ? fallbackIndex
            : direction === 'next'
                ? (currentIndex + 1) % searchResults.length
                : (currentIndex - 1 + searchResults.length) % searchResults.length;

        setSearchFocusKey((currentKey) => currentKey + 1);
        await handleSelectNodeFromCanvas(searchResults[nextIndex].node.id);
    };

    const handleToggleNodeCollapseFromCanvas = async (
        nodeId: number,
        isCollapsed: boolean,
    ) => {
        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        setTreeVisibilityMode('free');
        await onSetNodeCollapsed(nodeId, isCollapsed);
    };

    const handleQuickCreateChildFromCanvas = async (
        parentNodeId: number,
        parentTitle: string,
    ) => {
        if (treeBusy) {
            return;
        }

        const rawTitle = window.prompt(
            `Título del nuevo hijo para "${parentTitle}"`,
            '',
        );

        if (rawTitle === null) {
            return;
        }

        const normalizedTitle = rawTitle.trim();

        if (!normalizedTitle) {
            return;
        }

        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        const parentNode = nodesById.get(parentNodeId);

        if (!parentNode) {
            return;
        }

        if (parentNode.isCollapsed) {
            await onSetNodeCollapsed(parentNodeId, false);
        }

        await onCreateChildNode(parentNodeId, normalizedTitle);
    };

    const handleQuickDeleteLeafFromCanvas = async (
        nodeId: number,
        nodeTitle: string,
    ) => {
        if (treeBusy) {
            return;
        }

        const confirmed = window.confirm(
            `¿Eliminar definitivamente "${nodeTitle}"?`,
        );

        if (!confirmed) {
            return;
        }

        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        await onDeleteLeafNode(nodeId);
    };

    const handleToggleSelectedNodeCollapse = async () => {
        if (!selectedNode) {
            return;
        }

        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        setTreeVisibilityMode('free');
        await onSetNodeCollapsed(selectedNode.id, !selectedNode.isCollapsed);
    };

    const handleRenameOpenedDocument = async () => {
        if (!snapshot || treeBusy) {
            return;
        }

        const rawTitle = window.prompt(
            'Nuevo título del documento',
            snapshot.document.title,
        );

        if (rawTitle === null) {
            return;
        }

        const normalizedTitle = rawTitle.trim();

        if (!normalizedTitle || normalizedTitle === snapshot.document.title) {
            return;
        }

        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        await onRenameNode(snapshot.rootNodeId, normalizedTitle);
    };

    const handleLearningStatusChange = async (
        nextLearningStatus: NodeDto['learningStatus'],
    ) => {
        if (!selectedNode) {
            return;
        }

        if (selectedNode.learningStatus === nextLearningStatus) {
            return;
        }

        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        await onSetNodeLearningStatus(selectedNode.id, nextLearningStatus);
    };

    const handleQuickSetLearningStatusFromCanvas = async (
        nodeId: number,
        nextLearningStatus: NodeDto['learningStatus'],
    ) => {
        if (treeBusy) {
            return;
        }

        const node = nodesById.get(nodeId);

        if (!node) {
            return;
        }

        if ((childrenByParentId.get(node.id) ?? []).length > 0) {
            return;
        }

        if (node.learningStatus === nextLearningStatus) {
            return;
        }

        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        await onSetNodeLearningStatus(node.id, nextLearningStatus);
    };

    const handleRenameBlur = async () => {
        if (normalizedDraftTitle.length === 0) {
            setDraftTitle(originalTitle);
            return;
        }

        if (!isTitleDirty || !selectedNode) {
            setDraftTitle(originalTitle);
            return;
        }

        await onRenameNode(selectedNode.id, normalizedDraftTitle);
    };

    const handleRenameKeyDown = async (
        event: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await handleRenameBlur();
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            setDraftTitle(originalTitle);
        }
    };

    const handleCreateChildSubmit = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        if (!selectedNode) {
            return;
        }

        const normalizedTitle = newChildTitle.trim();

        if (!normalizedTitle) {
            return;
        }

        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        if (selectedNode.isCollapsed) {
            await onSetNodeCollapsed(selectedNode.id, false);
        }

        await onCreateChildNode(selectedNode.id, normalizedTitle);
        setNewChildTitle('');
    };

    const handleDeleteSelectedNode = async () => {
        if (!selectedNode) {
            return;
        }

        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        await onDeleteLeafNode(selectedNode.id);
    };

    const handleCreateDocumentFromSelectedNode = async () => {
        if (!snapshot || !selectedNode || treeBusy) {
            return;
        }

        const confirmed = window.confirm(
            `¿Crear un documento nuevo a partir de "${selectedNode.title}"?\n\nSe copiará este nodo con todos sus descendientes y se abrirá como documento independiente.`,
        );

        if (!confirmed) {
            return;
        }

        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        await onCreateDocumentFromNode(
            snapshot.document.id,
            selectedNode.id,
        );
    };

    const handleOpenChildFromDetails = async (childNodeId: number) => {
        if (treeBusy) {
            return;
        }

        if (childNodeId === selectedNodeId) {
            return;
        }

        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        await onSelectNode(childNodeId);
    };

    const handleOpenPathNodeFromDetails = async (pathNodeId: number) => {
        if (treeBusy) {
            return;
        }

        if (pathNodeId === selectedNodeId) {
            return;
        }

        if (hasPendingChanges) {
            await persistPendingChanges();
        }

        await onSelectNode(pathNodeId);
    };

    const selectedNodeDepth = useMemo(() => {
        if (!selectedNode) {
            return 0;
        }

        return getNodeDepth(selectedNode, nodesById);
    }, [selectedNode, nodesById]);

    const selectedNodePath = useMemo(() => {
        if (!selectedNode) {
            return '';
        }

        return getNodePathTitles(selectedNode, nodesById).join(' › ');
    }, [selectedNode, nodesById]);

    const selectedNodePathNodes = useMemo(() => {
        if (!selectedNode) {
            return [];
        }

        return getNodePathNodes(selectedNode, nodesById);
    }, [selectedNode, nodesById]);

    const selectedNodeChildren = selectedNode
        ? childrenByParentId.get(selectedNode.id) ?? []
        : [];

    const isSelectedNodeRoot = selectedNode?.parentId === null;
    const isSelectedNodeLeaf = selectedNodeChildren.length === 0;
    const canDeleteSelectedNode =
        !!selectedNode && !treeBusy && !isSelectedNodeRoot && isSelectedNodeLeaf;
    const canToggleSelectedNodeCollapse =
        !!selectedNode && !treeBusy && selectedNodeChildren.length > 0;

    const visualModeNodes = useMemo(() => {
        if (!snapshot || selectedNodeId === null) {
            return nodes;
        }

        return buildVisualModeNodes(
            nodes,
            snapshot.rootNodeId,
            selectedNodeId,
            treeVisibilityMode,
            nodesById,
            childrenByParentId,
            searchMatchNodeIds,
        );
    }, [
        snapshot,
        nodes,
        selectedNodeId,
        treeVisibilityMode,
        nodesById,
        childrenByParentId,
        searchMatchNodeIds,
    ]);

    const flowModel = useMemo(() => {
        if (!snapshot || selectedNodeId === null) {
            return {
                flowNodes: [] as StudyTreeFlowNode[],
                flowEdges: [] as Edge[],
            };
        }

        return buildVisualTree({
            nodes: visualModeNodes,
            rootNodeId: snapshot.rootNodeId,
            selectedNodeId,
            searchMatchNodeIds,
            isBusy: treeBusy,
            onSelectNode: handleSelectNodeFromCanvas,
            onOpenDetailsWorkspace: handleOpenDetailsWorkspaceFromCanvas,
            onToggleCollapse: handleToggleNodeCollapseFromCanvas,
            onQuickCreateChild: handleQuickCreateChildFromCanvas,
            onQuickDeleteLeaf: handleQuickDeleteLeafFromCanvas,
            onQuickSetLearningStatus: handleQuickSetLearningStatusFromCanvas,
        });
    }, [
        snapshot,
        visualModeNodes,
        selectedNodeId,
        treeBusy,
        searchMatchNodeIds,
        handleSelectNodeFromCanvas,
        handleOpenDetailsWorkspaceFromCanvas,
        handleToggleNodeCollapseFromCanvas,
        handleQuickCreateChildFromCanvas,
        handleQuickDeleteLeafFromCanvas,
        handleQuickSetLearningStatusFromCanvas,
    ]);

    const verticalFlowModel = useMemo(() => {
        if (!snapshot || selectedNodeId === null) {
            return {
                flowNodes: [] as StudyTreeFlowNode[],
                flowEdges: [] as Edge[],
            };
        }

        return buildVisualTree({
            nodes: visualModeNodes,
            rootNodeId: snapshot.rootNodeId,
            selectedNodeId,
            searchMatchNodeIds,
            isBusy: treeBusy,
            layoutDirection: 'vertical',
            onSelectNode: handleSelectNodeFromCanvas,
            onOpenDetailsWorkspace: handleOpenDetailsWorkspaceFromCanvas,
            onToggleCollapse: handleToggleNodeCollapseFromCanvas,
            onQuickCreateChild: handleQuickCreateChildFromCanvas,
            onQuickDeleteLeaf: handleQuickDeleteLeafFromCanvas,
            onQuickSetLearningStatus: handleQuickSetLearningStatusFromCanvas,
        });
    }, [
        snapshot,
        visualModeNodes,
        selectedNodeId,
        treeBusy,
        searchMatchNodeIds,
        handleSelectNodeFromCanvas,
        handleOpenDetailsWorkspaceFromCanvas,
        handleToggleNodeCollapseFromCanvas,
        handleQuickCreateChildFromCanvas,
        handleQuickDeleteLeafFromCanvas,
        handleQuickSetLearningStatusFromCanvas,
    ]);

    const radialFlowModel = useMemo(() => {
        if (!snapshot || selectedNodeId === null) {
            return {
                flowNodes: [] as StudyTreeFlowNode[],
                flowEdges: [] as Edge[],
            };
        }

        return buildVisualTree({
            nodes: visualModeNodes,
            rootNodeId: snapshot.rootNodeId,
            selectedNodeId,
            searchMatchNodeIds,
            isBusy: treeBusy,
            layoutDirection: 'radial',
            onSelectNode: handleSelectNodeFromCanvas,
            onOpenDetailsWorkspace: handleOpenDetailsWorkspaceFromCanvas,
            onToggleCollapse: handleToggleNodeCollapseFromCanvas,
            onQuickCreateChild: handleQuickCreateChildFromCanvas,
            onQuickDeleteLeaf: handleQuickDeleteLeafFromCanvas,
            onQuickSetLearningStatus: handleQuickSetLearningStatusFromCanvas,
        });
    }, [
        snapshot,
        visualModeNodes,
        selectedNodeId,
        treeBusy,
        searchMatchNodeIds,
        handleSelectNodeFromCanvas,
        handleOpenDetailsWorkspaceFromCanvas,
        handleToggleNodeCollapseFromCanvas,
        handleQuickCreateChildFromCanvas,
        handleQuickDeleteLeafFromCanvas,
        handleQuickSetLearningStatusFromCanvas,
    ]);

    const layoutSignature = useMemo(() => {
        const nodeIds = flowModel.flowNodes.map((node) => node.id).join('|');
        const edgeIds = flowModel.flowEdges.map((edge) => edge.id).join('|');

        return `${nodeIds}::${edgeIds}`;
    }, [flowModel.flowEdges, flowModel.flowNodes]);

    const verticalLayoutSignature = useMemo(() => {
        const nodeIds = verticalFlowModel.flowNodes.map((node) => node.id).join('|');
        const edgeIds = verticalFlowModel.flowEdges.map((edge) => edge.id).join('|');

        return `${nodeIds}::${edgeIds}`;
    }, [verticalFlowModel.flowEdges, verticalFlowModel.flowNodes]);

    const radialLayoutSignature = useMemo(() => {
        const nodeIds = radialFlowModel.flowNodes.map((node) => node.id).join('|');
        const edgeIds = radialFlowModel.flowEdges.map((edge) => edge.id).join('|');

        return `${nodeIds}::${edgeIds}`;
    }, [radialFlowModel.flowEdges, radialFlowModel.flowNodes]);

    const initialViewport = useMemo<Viewport>(() => {
        if (!snapshot) {
            return { x: 0, y: 0, zoom: 1 };
        }

        return {
            x: snapshot.viewState.panX,
            y: snapshot.viewState.panY,
            zoom: snapshot.viewState.zoom,
        };
    }, [snapshot]);



    const viewportSaveTimeoutRef = useRef<number | null>(null);
    const lastSavedViewportRef = useRef<Viewport | null>(null);
    const treeCanvasRef = useRef<HTMLDivElement | null>(null);
    const treeVerticalRef = useRef<HTMLDivElement | null>(null);
    const treeRadialRef = useRef<HTMLDivElement | null>(null);

    const resetRadialEdgeHoverStyles = useCallback(() => {
        const canvasElement = treeRadialRef.current;

        if (!canvasElement) {
            return;
        }

        canvasElement
            .querySelectorAll<SVGGElement>('.react-flow__edge')
            .forEach((edgeElement) => {
                edgeElement.style.opacity = '';
                edgeElement.style.removeProperty('--tree-edge-width');
                edgeElement.style.removeProperty('--tree-edge-width-active');
                edgeElement.style.removeProperty('--tree-edge-width-passive');

                edgeElement
                    .querySelectorAll<SVGPathElement>('.react-flow__edge-path')
                    .forEach((pathElement) => {
                        pathElement.style.opacity = '';
                        pathElement.style.strokeWidth = '';
                        pathElement.style.removeProperty('--tree-edge-width');
                        pathElement.style.removeProperty('--tree-edge-width-active');
                        pathElement.style.removeProperty('--tree-edge-width-passive');
                    });
            });
    }, []);

    const applyRadialEdgeHoverStyle = useCallback((
        edgeId: string,
        opacity: number,
        width: number,
    ) => {
        const canvasElement = treeRadialRef.current;

        if (!canvasElement) {
            return;
        }

        const edgeElement = canvasElement.querySelector<SVGGElement>(
            `.react-flow__edge[data-id="${edgeId}"]`,
        );

        if (!edgeElement) {
            return;
        }

        edgeElement.style.opacity = String(opacity);
        edgeElement.style.setProperty('--tree-edge-width', `${width}px`);
        edgeElement.style.setProperty('--tree-edge-width-active', `${Math.max(width, 1.95)}px`);
        edgeElement.style.setProperty('--tree-edge-width-passive', `${width}px`);

        edgeElement
            .querySelectorAll<SVGPathElement>('.react-flow__edge-path')
            .forEach((pathElement) => {
                pathElement.style.opacity = String(opacity);
                pathElement.style.strokeWidth = `${width}px`;
                pathElement.style.setProperty('--tree-edge-width', `${width}px`);
                pathElement.style.setProperty('--tree-edge-width-active', `${Math.max(width, 1.95)}px`);
                pathElement.style.setProperty('--tree-edge-width-passive', `${width}px`);
            });
    }, []);

    const handleRadialNodeMouseEnter = useCallback((
        _event: ReactMouseEvent,
        node: StudyTreeFlowNode,
    ) => {
        const hoveredNodeId = Number(node.id);
        let currentNode = nodesById.get(hoveredNodeId) ?? null;

        treeRadialRef.current
            ?.querySelectorAll<SVGGElement>('.react-flow__edge')
            .forEach((edgeElement) => {
                edgeElement.style.opacity = '0.32';
                edgeElement.style.setProperty('--tree-edge-width', '1.65px');
                edgeElement.style.setProperty('--tree-edge-width-active', '1.95px');
                edgeElement.style.setProperty('--tree-edge-width-passive', '1.65px');

                edgeElement
                    .querySelectorAll<SVGPathElement>('.react-flow__edge-path')
                    .forEach((pathElement) => {
                        pathElement.style.opacity = '0.32';
                        pathElement.style.strokeWidth = '1.65px';
                        pathElement.style.setProperty('--tree-edge-width', '1.65px');
                        pathElement.style.setProperty('--tree-edge-width-active', '1.95px');
                        pathElement.style.setProperty('--tree-edge-width-passive', '1.65px');
                    });
            });

        while (currentNode) {
            if (currentNode.parentId === null) {
                break;
            }

            applyRadialEdgeHoverStyle(
                `edge-${currentNode.parentId}-${currentNode.id}`,
                1,
                2.35,
            );
            currentNode = nodesById.get(currentNode.parentId) ?? null;
        }

        for (const child of childrenByParentId.get(hoveredNodeId) ?? []) {
            applyRadialEdgeHoverStyle(`edge-${hoveredNodeId}-${child.id}`, 1, 2.15);

            for (const grandchild of childrenByParentId.get(child.id) ?? []) {
                applyRadialEdgeHoverStyle(
                    `edge-${child.id}-${grandchild.id}`,
                    0.68,
                    1.85,
                );
            }
        }
    }, [
        applyRadialEdgeHoverStyle,
        childrenByParentId,
        nodesById,
    ]);

    const handleRadialNodeMouseLeave = useCallback(() => {
        resetRadialEdgeHoverStyles();
    }, [resetRadialEdgeHoverStyles]);

    useEffect(() => {
        if (!snapshot) {
            return;
        }

        lastSavedViewportRef.current = initialViewport;
    }, [snapshot?.document.id, initialViewport]);

    useEffect(() => {
        return () => {
            if (viewportSaveTimeoutRef.current !== null) {
                window.clearTimeout(viewportSaveTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!snapshot) {
            return;
        }

        setIsCanvasMaximized(true);
        setIsDetailsMaximized(false);
        setTreeViewMode('horizontal');
        setTreeVisibilityMode('free');
    }, [snapshot?.document.id]);

    const handleViewportMoveEnd = useCallback(
        (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
            if (!snapshot) {
                return;
            }

            if (viewportSaveTimeoutRef.current !== null) {
                window.clearTimeout(viewportSaveTimeoutRef.current);
            }

            viewportSaveTimeoutRef.current = window.setTimeout(() => {
                const lastSavedViewport = lastSavedViewportRef.current;

                if (lastSavedViewport && isSameViewport(lastSavedViewport, viewport)) {
                    return;
                }

                lastSavedViewportRef.current = viewport;

                void onSaveViewport(
                    snapshot.document.id,
                    viewport.x,
                    viewport.y,
                    viewport.zoom,
                );
            }, VIEWPORT_SAVE_DELAY_MS);
        },
        [onSaveViewport, snapshot],
    );

    if (!snapshot || !rootNode || selectedNodeId === null || !selectedNode) {
        return (
            <section className="root-tree-panel">
                <div className="root-tree-panel__empty">
                    <div className="root-tree-panel__empty-eyebrow">P6.B1 · canvas visual</div>
                    <h2 className="root-tree-panel__empty-title">Sin documento abierto</h2>
                    <p className="root-tree-panel__empty-text">
                        Selecciona un documento de la izquierda o crea uno nuevo para
                        visualizar el árbol en canvas, arrastrar el fondo y hacer zoom.
                    </p>
                </div>
            </section>
        );
    }

    const treeViewFocusNodeId = selectedNodeId ?? snapshot.rootNodeId;

    const horizontalTreeFocusKey = `${snapshot.document.id}:horizontal:${treeViewFocusNodeId}:${layoutSignature}`;

    const verticalTreeFocusKey = `${snapshot.document.id}:vertical:${treeViewFocusNodeId}:${verticalLayoutSignature}`;
    const searchTreeFocusKey = searchFocusKey > 0
        ? `${snapshot.document.id}:search:${treeViewMode}:${treeViewFocusNodeId}:${searchFocusKey}`
        : '';

    const canvasNodeActions = selectedNode ? (
        <CanvasNodeActions
            selectedNodeTitle={selectedNode.title}
            isBusy={treeBusy}
            isCreatingDocumentFromNode={
                isCreatingDocumentFromNodeId === selectedNode.id
            }
            errorMessage={createDocumentFromNodeErrorMessage}
            onCreateDocumentFromSelectedNode={
                handleCreateDocumentFromSelectedNode
            }
        />
    ) : null;



    let saveStatusText = 'Todo guardado.';
    if (isSelectingNodeId !== null) {
        saveStatusText = 'Cambiando selección…';
    } else if (isCreatingChild) {
        saveStatusText = 'Creando nodo hijo…';
    } else if (isTogglingCollapseNodeId !== null) {
        saveStatusText = 'Actualizando árbol…';
    } else if (isUpdatingLearningStatusNodeId !== null) {
        saveStatusText = 'Actualizando estado de aprendizaje…';
    } else if (isRenamingNodeId !== null) {
        saveStatusText = 'Renombrando nodo…';
    } else if (isDeletingNodeId !== null) {
        saveStatusText = 'Eliminando nodo…';
    } else if (isSavingContent) {
        saveStatusText = 'Guardando cambios…';
    } else if (isSavingViewport) {
        saveStatusText = 'Guardando viewport…';
    } else if (hasPendingChanges) {
        saveStatusText = 'Cambios pendientes. Guardado automático en breve.';
    }

    const selectedNodeKind = getNodeKindLabel(selectedNodeDepth);

    let collapseHint = 'Este nodo no tiene hijos visibles para expandir o colapsar.';
    if (selectedNodeChildren.length > 0) {
        collapseHint = selectedNode.isCollapsed
            ? 'La rama está colapsada. Puedes volver a expandirla.'
            : 'La rama está expandida. Puedes colapsarla sin perder persistencia.';
    }

    let deleteHint = 'Solo se pueden eliminar nodos hoja.';
    if (isSelectedNodeRoot) {
        deleteHint = 'El nodo root no se puede eliminar.';
    } else if (!isSelectedNodeLeaf) {
        deleteHint = 'Este nodo tiene hijos. Solo puedes eliminar nodos hoja.';
    } else {
        deleteHint = 'Se eliminará el nodo seleccionado y la selección pasará al padre.';
    }

    const showCanvasWorkspace = () => {
        setIsCanvasMaximized(true);
        setIsDetailsMaximized(false);
    };

    const showMixedWorkspace = () => {
        setIsCanvasMaximized(false);
        setIsDetailsMaximized(false);
    };

    const showDetailsWorkspace = () => {
        setIsCanvasMaximized(false);
        setIsDetailsMaximized(true);
    };

    const isMixedWorkspace = !isCanvasMaximized && !isDetailsMaximized;
    return (
        <section className="root-tree-panel">
            {!isDetailsMaximized ? (
                <header className="root-tree-panel__header">
                    <div>
                        <div className="root-tree-panel__eyebrow">P6.B1 · canvas visual</div>
                        <h2 className="root-tree-panel__title">{snapshot.document.title}</h2>
                    </div>

                    <div className="root-tree-panel__header-actions">
                        <div
                            className="root-tree-panel__selection"
                            title={`Selección activa: ${selectedNode.title}`}
                        >
                            Selección activa: {selectedNode.title}
                        </div>

                        <button
                            type="button"
                            className="root-tree-panel__header-action-button"
                            onClick={() => void handleRenameOpenedDocument()}
                            disabled={treeBusy}
                        >
                            Renombrar documento
                        </button>

                    </div>
                </header>
            ) : null}

            <div
                className={`root-tree-panel__body root-tree-panel__body--visual${isCanvasMaximized ? ' root-tree-panel__body--canvas-maximized' : ''}${isDetailsMaximized ? ' root-tree-panel__body--details-maximized' : ''}${isMixedWorkspace ? ' root-tree-panel__body--mixed' : ''}`}
            >
                {!isDetailsMaximized ? (
                    <div className="root-tree-panel__canvas-column">
                        <div className="root-tree-panel__canvas-column">
                            <section
                                className={`tree-canvas-card${isCanvasMaximized ? ' is-maximized' : ''}`}
                            >
                                <div className="tree-canvas-card__topbar">
                                    <div className="root-tree-panel__section-label">
                                        Árbol visual navegable
                                    </div>
                                    <div className="tree-view-mode-switch" aria-label="Modo de vista del árbol">
                                        <button
                                            type="button"
                                            className={`tree-view-mode-switch__button${treeViewMode === 'horizontal' ? ' is-active' : ''}`}
                                            onClick={() => setTreeViewMode('horizontal')}
                                        >
                                            Horizontal
                                        </button>

                                        <button
                                            type="button"
                                            className={`tree-view-mode-switch__button${treeViewMode === 'vertical' ? ' is-active' : ''}`}
                                            onClick={() => setTreeViewMode('vertical')}
                                        >
                                            Vertical
                                        </button>

                                        <button
                                            type="button"
                                            className={`tree-view-mode-switch__button${treeViewMode === 'radial' ? ' is-active' : ''}`}
                                            onClick={() => setTreeViewMode('radial')}
                                        >
                                            Radial
                                        </button>

                                        <button
                                            type="button"
                                            className={`tree-view-mode-switch__button${treeViewMode === 'outline' ? ' is-active' : ''}`}
                                            onClick={() => setTreeViewMode('outline')}
                                        >
                                            Esquema
                                        </button>
                                    </div>

                                    <div className="tree-view-mode-switch" aria-label="Visibilidad del árbol">
                                        <button
                                            type="button"
                                            className={`tree-view-mode-switch__button${treeVisibilityMode === 'free' ? ' is-active' : ''}`}
                                            onClick={() => setTreeVisibilityMode('free')}
                                            disabled={treeBusy}
                                        >
                                            Libre
                                        </button>

                                        <button
                                            type="button"
                                            className={`tree-view-mode-switch__button${treeVisibilityMode === 'expanded' ? ' is-active' : ''}`}
                                            onClick={() => setTreeVisibilityMode('expanded')}
                                            disabled={treeBusy}
                                        >
                                            Expandir
                                        </button>

                                        <button
                                            type="button"
                                            className={`tree-view-mode-switch__button${treeVisibilityMode === 'collapsed' ? ' is-active' : ''}`}
                                            onClick={() => setTreeVisibilityMode('collapsed')}
                                            disabled={treeBusy}
                                        >
                                            Colapsar
                                        </button>

                                        <button
                                            type="button"
                                            className={`tree-view-mode-switch__button${treeVisibilityMode === 'focus' ? ' is-active' : ''}`}
                                            onClick={() => setTreeVisibilityMode('focus')}
                                            disabled={treeBusy}
                                        >
                                            Foco
                                        </button>
                                    </div>

                                    <div className="node-search" role="search">
                                        <label className="visually-hidden" htmlFor="node-search-input">
                                            Buscar en nodos
                                        </label>
                                        <input
                                            id="node-search-input"
                                            className="node-search__input"
                                            type="search"
                                            value={nodeSearchQuery}
                                            onChange={(event) => setNodeSearchQuery(event.target.value)}
                                            placeholder="Buscar termino"
                                            spellCheck={false}
                                        />
                                        <div className="node-search__count" aria-live="polite">
                                            {normalizedNodeSearchQuery
                                                ? `${searchResults.length} coincid.`
                                                : 'Sin busqueda'}
                                        </div>
                                        <button
                                            type="button"
                                            className="node-search__nav-button"
                                            onClick={() => void handleGoToSearchResult('previous')}
                                            disabled={searchResults.length === 0 || treeBusy}
                                            aria-label="Coincidencia anterior"
                                            title="Coincidencia anterior"
                                        >
                                            {'<'}
                                        </button>
                                        <button
                                            type="button"
                                            className="node-search__nav-button"
                                            onClick={() => void handleGoToSearchResult('next')}
                                            disabled={searchResults.length === 0 || treeBusy}
                                            aria-label="Coincidencia siguiente"
                                            title="Coincidencia siguiente"
                                        >
                                            {'>'}
                                        </button>
                                        {nodeSearchQuery ? (
                                            <button
                                                type="button"
                                                className="node-search__clear-button"
                                                onClick={() => setNodeSearchQuery('')}
                                                aria-label="Limpiar busqueda"
                                                title="Limpiar busqueda"
                                            >
                                                x
                                            </button>
                                        ) : null}
                                    </div>

                                    <button
                                        type="button"
                                        className="tree-canvas-card__maximize-button"
                                        onClick={isCanvasMaximized ? showMixedWorkspace : showCanvasWorkspace}
                                    >
                                        {isCanvasMaximized ? 'Vista mixta' : 'Ampliar árbol'}
                                    </button>
                                </div>
                                <div className="tree-canvas__hint">
                                    Arrastra el fondo para hacer pan. Usa la rueda o los controles para hacer zoom.
                                </div>

                                {treeViewMode === 'horizontal' ? (
                                    <div
                                        ref={treeCanvasRef}
                                        className="tree-canvas"
                                        data-testid="tree-canvas"
                                    >
                                        {canvasNodeActions}

                                        <ReactFlow
                                            nodes={flowModel.flowNodes}
                                            edges={flowModel.flowEdges}
                                            nodeTypes={nodeTypes}
                                            minZoom={0.05}
                                            maxZoom={2}
                                            nodesDraggable={false}
                                            nodesConnectable={false}
                                            elementsSelectable={false}
                                            selectionOnDrag={false}
                                            zoomOnDoubleClick={false}
                                            panOnDrag
                                            panOnScroll={false}
                                            zoomOnScroll
                                            zoomOnPinch
                                            defaultViewport={initialViewport}
                                            onMoveEnd={handleViewportMoveEnd}
                                            onlyRenderVisibleElements
                                        >
                                            <ViewportPersistenceBridge
                                                documentId={snapshot.document.id}
                                                initialViewport={initialViewport}
                                            />
                                            <SelectionVisibilityBridge
                                                documentId={snapshot.document.id}
                                                selectedNodeId={selectedNodeId}
                                                layoutSignature={layoutSignature}
                                                canvasContainerRef={treeCanvasRef}
                                            />
                                            <TreeViewFocusBridge
                                                focusNodeId={treeViewFocusNodeId}
                                                focusKey={horizontalTreeFocusKey}
                                                zoom={0.55}
                                                duration={180}
                                            />
                                            {searchTreeFocusKey ? (
                                                <TreeViewFocusBridge
                                                    focusNodeId={treeViewFocusNodeId}
                                                    focusKey={searchTreeFocusKey}
                                                    zoom={0.72}
                                                    duration={260}
                                                />
                                            ) : null}
                                            <Background gap={24} size={1} />
                                            <Controls
                                                className="tree-canvas__zoom-controls"
                                                showInteractive={false}
                                                position="top-left"
                                            />
                                        </ReactFlow>
                                    </div>
                                ) : treeViewMode === 'vertical' ? (
                                    <div
                                        ref={treeVerticalRef}
                                        className="tree-canvas tree-canvas--vertical"
                                        data-testid="tree-vertical"
                                    >
                                        {canvasNodeActions}

                                        <ReactFlow
                                            nodes={verticalFlowModel.flowNodes}
                                            edges={verticalFlowModel.flowEdges}
                                            nodeTypes={nodeTypes}
                                            minZoom={0.05}
                                            maxZoom={2}
                                            nodesDraggable={false}
                                            nodesConnectable={false}
                                            elementsSelectable={false}
                                            selectionOnDrag={false}
                                            zoomOnDoubleClick={false}
                                            panOnDrag
                                            panOnScroll={false}
                                            zoomOnScroll
                                            zoomOnPinch
                                            fitView
                                            fitViewOptions={{
                                                padding: 0.18,
                                                minZoom: 0.05,
                                                maxZoom: 1,
                                            }}
                                            onlyRenderVisibleElements
                                        >
                                            <SelectionVisibilityBridge
                                                documentId={snapshot.document.id}
                                                selectedNodeId={selectedNodeId}
                                                layoutSignature={layoutSignature}
                                                canvasContainerRef={treeVerticalRef}
                                            />
                                            <TreeViewFocusBridge
                                                focusNodeId={treeViewFocusNodeId}
                                                focusKey={verticalTreeFocusKey}
                                                zoom={0.42}
                                                duration={180}
                                            />
                                            {searchTreeFocusKey ? (
                                                <TreeViewFocusBridge
                                                    focusNodeId={treeViewFocusNodeId}
                                                    focusKey={searchTreeFocusKey}
                                                    zoom={0.62}
                                                    duration={260}
                                                />
                                            ) : null}
                                            <Background gap={24} size={1} />
                                            <Controls
                                                className="tree-canvas__zoom-controls"
                                                showInteractive={false}
                                                position="top-left"
                                            />
                                        </ReactFlow>
                                    </div>
                                ) : treeViewMode === 'radial' ? (
                                    <div
                                        ref={treeRadialRef}
                                        className="tree-canvas tree-canvas--radial"
                                        data-testid="tree-radial"
                                    >
                                        {canvasNodeActions}

                                        <ReactFlow
                                            nodes={radialFlowModel.flowNodes}
                                            edges={radialFlowModel.flowEdges}
                                            nodeTypes={nodeTypes}
                                            minZoom={0.02}
                                            maxZoom={2.5}
                                            nodesDraggable={false}
                                            nodesConnectable={false}
                                            elementsSelectable={false}
                                            selectionOnDrag={false}
                                            zoomOnDoubleClick={false}
                                            panOnDrag
                                            panOnScroll={false}
                                            zoomOnScroll
                                            zoomOnPinch
                                            onNodeMouseEnter={handleRadialNodeMouseEnter}
                                            onNodeMouseLeave={handleRadialNodeMouseLeave}
                                            fitView
                                            fitViewOptions={{
                                                padding: 0.28,
                                                minZoom: 0.02,
                                                maxZoom: 0.75,
                                            }}
                                            onlyRenderVisibleElements
                                        >
                                            <SelectionVisibilityBridge
                                                documentId={snapshot.document.id}
                                                selectedNodeId={selectedNodeId}
                                                layoutSignature={radialLayoutSignature}
                                                canvasContainerRef={treeRadialRef}
                                            />
                                            {searchTreeFocusKey ? (
                                                <TreeViewFocusBridge
                                                    focusNodeId={treeViewFocusNodeId}
                                                    focusKey={searchTreeFocusKey}
                                                    zoom={0.95}
                                                    duration={280}
                                                />
                                            ) : null}
                                            <Background gap={24} size={1} />
                                            <Controls
                                                className="tree-canvas__zoom-controls"
                                                showInteractive={false}
                                                position="top-left"
                                            />
                                        </ReactFlow>
                                    </div>
                                ) : (
                                    <div
                                        className="tree-canvas tree-canvas--outline"
                                        data-testid="tree-outline-canvas"
                                    >
                                        <div
                                            className="tree-outline-scroll"
                                            data-testid="tree-outline-scroll"
                                        >
                                            <TreeOutline
                                                nodes={visualModeNodes}
                                                rootNodeId={snapshot.rootNodeId}
                                                selectedNodeId={selectedNodeId}
                                                searchMatchNodeIds={searchMatchNodeIds}
                                                isBusy={treeBusy}
                                                onSelectNode={handleSelectNodeFromCanvas}
                                                onOpenDetailsWorkspace={handleOpenDetailsWorkspaceFromCanvas}
                                                onToggleCollapse={handleToggleNodeCollapseFromCanvas}
                                                onCreateChild={handleQuickCreateChildFromCanvas}
                                                onDeleteLeaf={handleQuickDeleteLeafFromCanvas}
                                            />
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                ) : null}

                {!isCanvasMaximized ? (
                    <div
                        className={`root-tree-panel__details-grid${isDetailsMaximized ? ' root-tree-panel__details-grid--focus' : ''}`}
                    >
                        <div className="details-panel__topbar">
                            <div className="root-tree-panel__section-label details-panel__kicker">
                                Nodo en estudio
                            </div>
                            <div className="node-search node-search--details" role="search">
                                <label className="visually-hidden" htmlFor="node-search-details-input">
                                    Buscar en nodos
                                </label>
                                <input
                                    id="node-search-details-input"
                                    className="node-search__input"
                                    type="search"
                                    value={nodeSearchQuery}
                                    onChange={(event) => setNodeSearchQuery(event.target.value)}
                                    placeholder="Buscar termino"
                                    spellCheck={false}
                                />
                                <div className="node-search__count" aria-live="polite">
                                    {normalizedNodeSearchQuery
                                        ? `${searchResults.length} coincid.`
                                        : 'Sin busqueda'}
                                </div>
                                <button
                                    type="button"
                                    className="node-search__nav-button"
                                    onClick={() => void handleGoToSearchResult('previous')}
                                    disabled={searchResults.length === 0 || treeBusy}
                                    aria-label="Coincidencia anterior"
                                    title="Coincidencia anterior"
                                >
                                    {'<'}
                                </button>
                                <button
                                    type="button"
                                    className="node-search__nav-button"
                                    onClick={() => void handleGoToSearchResult('next')}
                                    disabled={searchResults.length === 0 || treeBusy}
                                    aria-label="Coincidencia siguiente"
                                    title="Coincidencia siguiente"
                                >
                                    {'>'}
                                </button>
                                {nodeSearchQuery ? (
                                    <button
                                        type="button"
                                        className="node-search__clear-button"
                                        onClick={() => setNodeSearchQuery('')}
                                        aria-label="Limpiar busqueda"
                                        title="Limpiar busqueda"
                                    >
                                        x
                                    </button>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                className="details-panel__maximize-button"
                                onClick={isDetailsMaximized ? showCanvasWorkspace : showDetailsWorkspace}
                            >
                                {isDetailsMaximized ? 'Volver al árbol' : 'Ampliar ficha'}
                            </button>
                        </div>

                        {!isDetailsMaximized ? (
                            <form className="child-create-form" onSubmit={handleCreateChildSubmit}>
                                <label className="child-create-form__label" htmlFor="new-child-title">
                                    Nuevo hijo del nodo seleccionado
                                </label>

                                <div className="child-create-form__context">
                                    Padre activo: {selectedNodeKind} · {selectedNode.title}
                                </div>

                                <input
                                    id="new-child-title"
                                    className="child-create-form__input"
                                    type="text"
                                    value={newChildTitle}
                                    onChange={(event) => setNewChildTitle(event.target.value)}
                                    placeholder="Ej. Subepígrafe 1.1"
                                    disabled={treeBusy}
                                />

                                <button
                                    type="submit"
                                    className="child-create-form__button"
                                    disabled={treeBusy || newChildTitle.trim().length === 0}
                                >
                                    {isCreatingChild ? 'Creando…' : 'Crear hijo'}
                                </button>
                            </form>
                        ) : null}

                        <section className="study-hero-card node-title-card">
                            <label
                                className="visually-hidden"
                                htmlFor="selected-node-title"
                            >
                                Título del nodo
                            </label>

                            <nav
                                className="study-hero-card__path"
                                title={selectedNodePath}
                                data-testid="selected-node-path"
                                aria-label="Ruta del nodo"
                            >
                                {selectedNodePathNodes.map((pathNode, index) => {
                                    const isCurrentNode = pathNode.id === selectedNode.id;

                                    return (
                                        <span
                                            key={pathNode.id}
                                            className="study-hero-card__path-item-wrap"
                                        >
                                            {index > 0 ? (
                                                <span className="study-hero-card__path-separator">
                                                    ›
                                                </span>
                                            ) : null}

                                            {isCurrentNode ? (
                                                <span className="study-hero-card__path-current">
                                                    {pathNode.title}
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="study-hero-card__path-button"
                                                    onClick={() => void handleOpenPathNodeFromDetails(pathNode.id)}
                                                    disabled={treeBusy}
                                                    title={`Abrir ${pathNode.title}`}
                                                >
                                                    {pathNode.title}
                                                </button>
                                            )}
                                        </span>
                                    );
                                })}
                            </nav>

                            <input
                                id="selected-node-title"
                                className="node-title-input study-hero-card__title-input"
                                type="text"
                                value={draftTitle}
                                onChange={(event) => setDraftTitle(event.target.value)}
                                onBlur={() => void handleRenameBlur()}
                                onKeyDown={(event) => void handleRenameKeyDown(event)}
                                placeholder="Escribe el título del nodo"
                                disabled={treeBusy}
                                aria-label="Título del nodo"
                            />

                            <div className="node-title-hint study-hero-card__hint">
                                Pulsa Enter o sal del campo para guardar el nuevo título.
                            </div>
                        </section>

                        {normalizedNodeSearchQuery && selectedNodeSearchResult ? (
                            <section className="content-card node-search-card">
                                <div className="content-card__label">Coincidencias en este nodo</div>
                                <div className="node-search-card__matches">
                                    {selectedNodeSearchResult.matchedFields.map((field) => (
                                        <div key={field.key} className="node-search-card__match">
                                            <div className="node-search-card__field">{field.label}</div>
                                            <div className="node-search-card__preview">
                                                {renderHighlightedText(field.preview, nodeSearchQuery)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        <section className="content-card learning-status-card">
                            <label
                                className="content-card__label"
                                htmlFor="selected-node-learning-status"
                            >
                                Estado de aprendizaje
                            </label>
                            <select
                                id="selected-node-learning-status"
                                className="learning-status-select"
                                value={selectedNode.learningStatus}
                                onChange={(event) => {
                                    const nextLearningStatus =
                                        event.target.value as NodeDto['learningStatus'];
                                    void handleLearningStatusChange(nextLearningStatus);
                                }}
                                disabled={treeBusy || !isSelectedNodeLearningStatusEditable}
                            >
                                {LEARNING_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <div className="learning-status-hint">
                                {isSelectedNodeLearningStatusEditable
                                    ? 'Este cambio actualiza el color del nodo y se refleja en el canvas.'
                                    : 'Estado calculado automáticamente a partir de sus hijos.'}
                            </div>
                        </section>
                        {!isDetailsMaximized ? (
                            <section className="content-card tree-action-card">
                                <div className="content-card__label">Expandir o colapsar rama</div>

                                <button
                                    type="button"
                                    className="tree-action-button"
                                    onClick={() => void handleToggleSelectedNodeCollapse()}
                                    disabled={!canToggleSelectedNodeCollapse}
                                    data-testid={`toggle-node-${selectedNode.id}-button`}
                                >
                                    {selectedNode.isCollapsed ? 'Expandir rama' : 'Colapsar rama'}
                                </button>

                                <div className="tree-action-hint">{collapseHint}</div>
                            </section>
                        ) : null}
                        {!isDetailsMaximized ? (
                            <section className="content-card delete-node-card">
                                <div className="content-card__label">Eliminar nodo</div>

                                <button
                                    type="button"
                                    className="delete-leaf-button"
                                    onClick={() => void handleDeleteSelectedNode()}
                                    disabled={!canDeleteSelectedNode}
                                >
                                    {isDeletingNodeId === selectedNode.id ? 'Eliminando…' : 'Eliminar nodo hoja'}
                                </button>

                                <div className="delete-leaf-hint">{deleteHint}</div>
                            </section>
                        ) : null}

                        <div className="details-side-column">
                            <section className="content-card note-card">
                                <label className="content-card__label" htmlFor="selected-node-note">
                                    Nota
                                </label>

                                <textarea
                                    id="selected-node-note"
                                    className="content-editor__input content-editor__input--note"
                                    value={draftNote}
                                    onChange={(event) => setDraftNote(event.target.value)}
                                    placeholder="Escribe una nota breve para este nodo"
                                    disabled={selectedContent === null || treeBusy}
                                />
                            </section>

                            <section className="content-card node-children-card">
                                <div className="content-card__label">Hijos</div>

                                {selectedNodeChildren.length > 0 ? (
                                    <div className="node-children-list">
                                        {selectedNodeChildren.map((childNode) => (
                                            <button
                                                key={childNode.id}
                                                type="button"
                                                className="node-children-list__button"
                                                onClick={() => void handleOpenChildFromDetails(childNode.id)}
                                                disabled={treeBusy}
                                                title={childNode.title}
                                            >
                                                {childNode.title}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="node-children-list__empty">
                                        Este nodo no tiene hijos.
                                    </div>
                                )}
                            </section>
                        </div>

                        <section className="content-card content-card--body content-body-card">
                            <div className="content-card__label" id="selected-node-body-label">
                                Contenido
                            </div>

                            <RichContentEditor
                                value={draftBody}
                                onChange={setDraftBody}
                                placeholder="Escribe el contenido principal del nodo"
                                disabled={selectedContent === null || treeBusy}
                                ariaLabelledBy="selected-node-body-label"
                            />
                        </section>

                        <div className="content-editor__footer">
                            <div className="content-editor__status">{saveStatusText}</div>

                            {saveErrorMessage ? (
                                <div className="content-editor__error">{saveErrorMessage}</div>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
