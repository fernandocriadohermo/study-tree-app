import type { NodeDto } from '../../../shared/documents/contracts';

interface TreeOutlineProps {
    nodes: NodeDto[];
    rootNodeId: number;
    selectedNodeId: number;
    isBusy: boolean;
    onSelectNode: (nodeId: number) => Promise<void> | void;
    onOpenDetailsWorkspace: (nodeId: number) => Promise<void> | void;
    onToggleCollapse: (nodeId: number, isCollapsed: boolean) => Promise<void> | void;
}

interface VisibleOutlineNode {
    node: NodeDto;
    depth: number;
    hasChildren: boolean;
}

const LEARNING_STATUS_LABELS: Record<NodeDto['learningStatus'], string> = {
    sin_ver: 'Sin ver',
    visto: 'Visto',
    en_estudio: 'En estudio',
    dominado: 'Dominado',
};

function sortBySiblingOrder(nodes: NodeDto[]): NodeDto[] {
    return [...nodes].sort((a, b) => {
        if (a.siblingOrder !== b.siblingOrder) {
            return a.siblingOrder - b.siblingOrder;
        }

        return a.id - b.id;
    });
}

function buildChildrenByParentId(nodes: NodeDto[]): Map<number, NodeDto[]> {
    const childrenByParentId = new Map<number, NodeDto[]>();

    for (const node of nodes) {
        if (node.parentId === null) {
            continue;
        }

        const siblings = childrenByParentId.get(node.parentId) ?? [];
        siblings.push(node);
        childrenByParentId.set(node.parentId, siblings);
    }

    for (const [parentId, children] of childrenByParentId.entries()) {
        childrenByParentId.set(parentId, sortBySiblingOrder(children));
    }

    return childrenByParentId;
}

function buildVisibleOutlineNodes(
    rootNode: NodeDto,
    childrenByParentId: Map<number, NodeDto[]>,
): VisibleOutlineNode[] {
    const visibleNodes: VisibleOutlineNode[] = [];

    const visitNode = (node: NodeDto, depth: number) => {
        const children = childrenByParentId.get(node.id) ?? [];
        const hasChildren = children.length > 0;

        visibleNodes.push({
            node,
            depth,
            hasChildren,
        });

        if (node.isCollapsed) {
            return;
        }

        for (const child of children) {
            visitNode(child, depth + 1);
        }
    };

    visitNode(rootNode, 0);

    return visibleNodes;
}

export function TreeOutline({
    nodes,
    rootNodeId,
    selectedNodeId,
    isBusy,
    onSelectNode,
    onOpenDetailsWorkspace,
    onToggleCollapse,
}: TreeOutlineProps) {
    const rootNode = nodes.find((node) => node.id === rootNodeId) ?? null;

    if (!rootNode) {
        return (
            <div className="tree-outline-empty">
                No se encontró el nodo raíz del documento.
            </div>
        );
    }

    const childrenByParentId = buildChildrenByParentId(nodes);
    const visibleNodes = buildVisibleOutlineNodes(rootNode, childrenByParentId);

    return (
        <div className="tree-outline" data-testid="tree-outline">
            <div className="tree-outline__header">
                <div>
                    <div className="tree-outline__title">Vista esquema</div>
                    <div className="tree-outline__hint">
                        Índice jerárquico navegable. Clic para seleccionar, doble clic para abrir ficha.
                    </div>
                </div>

                <div className="tree-outline__count">
                    {visibleNodes.length} visibles / {nodes.length} totales
                </div>
            </div>

            <div className="tree-outline__list" aria-label="Vista esquema del árbol">
                {visibleNodes.map(({ node, depth, hasChildren }) => {
                    const isSelected = node.id === selectedNodeId;

                    return (
                        <div
                            key={node.id}
                            className={`tree-outline__row${isSelected ? ' is-selected' : ''}`}
                            style={{ paddingLeft: `${12 + depth * 22}px` }}
                            data-testid={`tree-outline-node-${node.id}`}
                            role="button"
                            tabIndex={isBusy ? -1 : 0}
                            aria-label={node.title}
                            aria-current={isSelected ? 'true' : undefined}
                            onClick={() => {
                                if (isBusy) {
                                    return;
                                }

                                void onSelectNode(node.id);
                            }}
                            onDoubleClick={() => {
                                if (isBusy) {
                                    return;
                                }

                                void onOpenDetailsWorkspace(node.id);
                            }}
                            onKeyDown={(event) => {
                                if (isBusy) {
                                    return;
                                }

                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void onSelectNode(node.id);
                                }

                                if (event.key === ' ') {
                                    event.preventDefault();
                                    void onOpenDetailsWorkspace(node.id);
                                }
                            }}
                        >
                            <button
                                type="button"
                                className={`tree-outline__toggle${hasChildren ? '' : ' is-hidden'}`}
                                disabled={isBusy || !hasChildren}
                                aria-label={node.isCollapsed ? 'Expandir rama' : 'Colapsar rama'}
                                title={node.isCollapsed ? 'Expandir rama' : 'Colapsar rama'}
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();

                                    if (!hasChildren || isBusy) {
                                        return;
                                    }

                                    void onToggleCollapse(node.id, !node.isCollapsed);
                                }}
                            >
                                {node.isCollapsed ? '▸' : '▾'}
                            </button>

                            <div
                                className={`tree-outline__status-dot tree-outline__status-dot--${node.learningStatus}`}
                                aria-hidden="true"
                            />

                            <div className="tree-outline__node-main">
                                <div className="tree-outline__node-title">
                                    {node.title}
                                </div>

                                <div className="tree-outline__node-meta">
                                    #{node.id} · {LEARNING_STATUS_LABELS[node.learningStatus]}
                                </div>
                            </div>

                            {hasChildren ? (
                                <div className="tree-outline__children-count">
                                    {(childrenByParentId.get(node.id) ?? []).length}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}