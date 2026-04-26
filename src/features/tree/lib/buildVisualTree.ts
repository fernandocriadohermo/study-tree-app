import { Position, type Edge, type Node } from '@xyflow/react';
import type { NodeDto } from '../../../shared/documents/contracts';

export const VISUAL_NODE_WIDTH = 236;
export const VISUAL_NODE_HEIGHT = 132;

const RADIAL_VISUAL_NODE_WIDTH = 210;
const RADIAL_VISUAL_NODE_HEIGHT = 112;

const RADIAL_ROOT_VISUAL_NODE_WIDTH = 320;
const RADIAL_ROOT_VISUAL_NODE_HEIGHT = 152;

const RADIAL_NODE_TITLE_CHARS_PER_LINE = 24;
const RADIAL_ROOT_TITLE_CHARS_PER_LINE = 23;

const RADIAL_NODE_FIXED_VERTICAL_SPACE = 58;
const RADIAL_ROOT_FIXED_VERTICAL_SPACE = 84;

const RADIAL_NODE_TITLE_LINE_HEIGHT = 16;
const RADIAL_ROOT_TITLE_LINE_HEIGHT = 22;

const HORIZONTAL_GAP = 176;
const VERTICAL_GAP = 68;

const VERTICAL_TREE_HORIZONTAL_GAP_MAX = 64;
const VERTICAL_TREE_HORIZONTAL_GAP_MIN = 18;

const VERTICAL_TREE_VERTICAL_GAP_MIN = 96;
const VERTICAL_TREE_VERTICAL_GAP_MAX = 176;

const RADIAL_TREE_FIRST_RING_RADIUS_MIN = 360;
const RADIAL_TREE_RING_GAP = 118;
const RADIAL_TREE_NODE_ARC_GAP = 28;
const RADIAL_TREE_NODE_CAPACITY_WIDTH_FACTOR = 1;
const RADIAL_TREE_RADIUS_SAFETY_PADDING = 12;



const RADIAL_TREE_START_ANGLE = -Math.PI / 2;
const RADIAL_TREE_END_ANGLE = RADIAL_TREE_START_ANGLE + Math.PI * 2;

export type VisualTreeLayoutDirection = 'horizontal' | 'vertical' | 'radial';

type LinearTreeLayoutDirection = Exclude<VisualTreeLayoutDirection, 'radial'>;

type LayoutPosition = {
    x: number;
    y: number;
    depth: number;
    angle?: number;
};

type VisualNodeSize = {
    width: number;
    height: number;
};

type VisualEdgeType = NonNullable<Edge['type']>;

const VISUAL_EDGE_TYPE_HORIZONTAL: VisualEdgeType = 'bezier';
const VISUAL_EDGE_TYPE_VERTICAL: VisualEdgeType = 'smoothstep';
const VISUAL_EDGE_TYPE_RADIAL: VisualEdgeType = 'straight';

// Para experimentar, copia una de estas líneas sobre la constante correspondiente:
// const VISUAL_EDGE_TYPE_HORIZONTAL: VisualEdgeType = 'default';
// const VISUAL_EDGE_TYPE_HORIZONTAL: VisualEdgeType = 'straight';
// const VISUAL_EDGE_TYPE_HORIZONTAL: VisualEdgeType = 'smoothstep';
// const VISUAL_EDGE_TYPE_HORIZONTAL: VisualEdgeType = 'step';
// const VISUAL_EDGE_TYPE_HORIZONTAL: VisualEdgeType = 'simplebezier';
// const VISUAL_EDGE_TYPE_VERTICAL: VisualEdgeType = 'default';
// const VISUAL_EDGE_TYPE_VERTICAL: VisualEdgeType = 'straight';
// const VISUAL_EDGE_TYPE_VERTICAL: VisualEdgeType = 'smoothstep';
// const VISUAL_EDGE_TYPE_VERTICAL: VisualEdgeType = 'step';
// const VISUAL_EDGE_TYPE_VERTICAL: VisualEdgeType = 'simplebezier';
// const VISUAL_EDGE_TYPE_RADIAL: VisualEdgeType = 'default';
// const VISUAL_EDGE_TYPE_RADIAL: VisualEdgeType = 'straight';
// const VISUAL_EDGE_TYPE_RADIAL: VisualEdgeType = 'smoothstep';
// const VISUAL_EDGE_TYPE_RADIAL: VisualEdgeType = 'step';
// const VISUAL_EDGE_TYPE_RADIAL: VisualEdgeType = 'simplebezier';

function getVisualEdgeType(
    layoutDirection: VisualTreeLayoutDirection,
): VisualEdgeType {
    if (layoutDirection === 'radial') {
        return VISUAL_EDGE_TYPE_RADIAL;
    }

    if (layoutDirection === 'vertical') {
        return VISUAL_EDGE_TYPE_VERTICAL;
    }

    return VISUAL_EDGE_TYPE_HORIZONTAL;
}

type RadialAngleLayout = {
    node: NodeDto;
    depth: number;
    angle: number;
    visualNodeSize: VisualNodeSize;
    treeOrder: number;
    leafSlot: number;
};

function estimateWrappedLineCount(text: string, charsPerLine: number): number {
    const words = text.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
        return 1;
    }

    let lineCount = 1;
    let currentLineLength = 0;

    for (const word of words) {
        if (word.length > charsPerLine) {
            if (currentLineLength > 0) {
                lineCount += 1;
                currentLineLength = 0;
            }

            const wrappedWordLineCount = Math.ceil(word.length / charsPerLine);
            lineCount += wrappedWordLineCount - 1;

            const remainingLength = word.length % charsPerLine;
            currentLineLength =
                remainingLength === 0 ? charsPerLine : remainingLength;

            continue;
        }

        const nextLineLength =
            currentLineLength === 0
                ? word.length
                : currentLineLength + 1 + word.length;

        if (nextLineLength <= charsPerLine) {
            currentLineLength = nextLineLength;
            continue;
        }

        lineCount += 1;
        currentLineLength = word.length;
    }

    return lineCount;
}

function getRadialVisualNodeSize(node: NodeDto, depth: number): VisualNodeSize {
    if (depth === 0) {
        const estimatedTitleLineCount = estimateWrappedLineCount(
            node.title,
            RADIAL_ROOT_TITLE_CHARS_PER_LINE,
        );

        return {
            width: RADIAL_ROOT_VISUAL_NODE_WIDTH,
            height: Math.max(
                RADIAL_ROOT_VISUAL_NODE_HEIGHT,
                RADIAL_ROOT_FIXED_VERTICAL_SPACE +
                estimatedTitleLineCount * RADIAL_ROOT_TITLE_LINE_HEIGHT,
            ),
        };
    }

    const estimatedTitleLineCount = estimateWrappedLineCount(
        node.title,
        RADIAL_NODE_TITLE_CHARS_PER_LINE,
    );

    return {
        width: RADIAL_VISUAL_NODE_WIDTH,
        height: Math.max(
            RADIAL_VISUAL_NODE_HEIGHT,
            RADIAL_NODE_FIXED_VERTICAL_SPACE +
            estimatedTitleLineCount * RADIAL_NODE_TITLE_LINE_HEIGHT,
        ),
    };
}

export type StudyTreeNodeData = Record<string, unknown> & {
    nodeId: number;
    title: string;
    learningStatus: NodeDto['learningStatus'];
    kindLabel: string;
    layoutDirection?: VisualTreeLayoutDirection;
    isCompactLayout?: boolean;
    sourceHandlePosition?: Position;
    targetHandlePosition?: Position;
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
        (VERTICAL_TREE_HORIZONTAL_GAP_MAX - VERTICAL_TREE_HORIZONTAL_GAP_MIN) *
        pressure;

    const verticalGap =
        VERTICAL_TREE_VERTICAL_GAP_MIN +
        (VERTICAL_TREE_VERTICAL_GAP_MAX - VERTICAL_TREE_VERTICAL_GAP_MIN) *
        pressure;

    return {
        horizontalGap: Math.round(horizontalGap),
        verticalGap: Math.round(verticalGap),
    };
}

function collectRadialSlotLayouts(
    node: NodeDto,
    depth: number,
    childrenByParentId: Map<number, NodeDto[]>,
    radialLayoutsByNodeId: Map<number, RadialAngleLayout>,
    treeOrderRef: { value: number },
    leafSlotRef: { value: number },
): {
    startLeafSlot: number;
    endLeafSlot: number;
    centerLeafSlot: number;
} {
    const treeOrder = treeOrderRef.value;
    treeOrderRef.value += 1;

    const visibleChildren = node.isCollapsed
        ? []
        : childrenByParentId.get(node.id) ?? [];

    if (visibleChildren.length === 0) {
        const leafSlot = leafSlotRef.value;
        leafSlotRef.value += 1;

        radialLayoutsByNodeId.set(node.id, {
            node,
            depth,
            angle: 0,
            visualNodeSize: getRadialVisualNodeSize(node, depth),
            treeOrder,
            leafSlot,
        });

        return {
            startLeafSlot: leafSlot,
            endLeafSlot: leafSlot,
            centerLeafSlot: leafSlot,
        };
    }

    const childRanges = visibleChildren.map((child) =>
        collectRadialSlotLayouts(
            child,
            depth + 1,
            childrenByParentId,
            radialLayoutsByNodeId,
            treeOrderRef,
            leafSlotRef,
        ),
    );

    const firstChildRange = childRanges[0];
    const lastChildRange = childRanges[childRanges.length - 1];

    const startLeafSlot = firstChildRange.startLeafSlot;
    const endLeafSlot = lastChildRange.endLeafSlot;
    const centerLeafSlot = (startLeafSlot + endLeafSlot) / 2;

    radialLayoutsByNodeId.set(node.id, {
        node,
        depth,
        angle: 0,
        visualNodeSize: getRadialVisualNodeSize(node, depth),
        treeOrder,
        leafSlot: centerLeafSlot,
    });

    return {
        startLeafSlot,
        endLeafSlot,
        centerLeafSlot,
    };
}

function assignRadialAnglesByLeafSlot(
    radialLayoutsByNodeId: Map<number, RadialAngleLayout>,
    visibleLeafCount: number,
): void {
    const safeVisibleLeafCount = Math.max(visibleLeafCount, 1);
    const fullCircle = RADIAL_TREE_END_ANGLE - RADIAL_TREE_START_ANGLE;
    const angleStep = fullCircle / safeVisibleLeafCount;

    for (const radialLayout of radialLayoutsByNodeId.values()) {
        radialLayout.angle =
            RADIAL_TREE_START_ANGLE +
            (radialLayout.leafSlot + 0.5) * angleStep;
    }
}

function groupRadialLayoutsByDepth(
    radialLayoutsByNodeId: Map<number, RadialAngleLayout>,
): Map<number, RadialAngleLayout[]> {
    const layoutsByDepth = new Map<number, RadialAngleLayout[]>();

    for (const layout of radialLayoutsByNodeId.values()) {
        const currentLayouts = layoutsByDepth.get(layout.depth) ?? [];
        currentLayouts.push(layout);
        layoutsByDepth.set(layout.depth, currentLayouts);
    }

    for (const [depth, layouts] of layoutsByDepth.entries()) {
        layoutsByDepth.set(
            depth,
            [...layouts].sort((a, b) => {
                if (a.leafSlot !== b.leafSlot) {
                    return a.leafSlot - b.leafSlot;
                }

                return a.treeOrder - b.treeOrder;
            }),
        );
    }

    return layoutsByDepth;
}

function getRadialNodeRadialExtent(layout: RadialAngleLayout): number {
    return Math.max(layout.visualNodeSize.width, layout.visualNodeSize.height);
}

function getMaximumRadialNodeExtent(layouts: RadialAngleLayout[]): number {
    return layouts.reduce((maximumExtent, layout) => {
        return Math.max(maximumExtent, getRadialNodeRadialExtent(layout));
    }, 0);
}

function getRadialNodeArcDemand(layout: RadialAngleLayout): number {
    return (
        Math.max(
            layout.visualNodeSize.width * RADIAL_TREE_NODE_CAPACITY_WIDTH_FACTOR,
            layout.visualNodeSize.height,
        ) + RADIAL_TREE_NODE_ARC_GAP
    );
}

function getRadialRingCapacityRadius(layouts: RadialAngleLayout[]): number {
    if (layouts.length <= 1) {
        return 0;
    }

    const requiredCircumference = layouts.reduce((total, layout) => {
        return total + getRadialNodeArcDemand(layout);
    }, 0);

    return Math.ceil(
        requiredCircumference / (Math.PI * 2) +
        RADIAL_TREE_RADIUS_SAFETY_PADDING,
    );
}

function normalizeRadialAngle(angle: number): number {
    const fullCircle = Math.PI * 2;
    const normalizedAngle = angle % fullCircle;

    return normalizedAngle < 0 ? normalizedAngle + fullCircle : normalizedAngle;
}

function getRequiredRadiusForChord(
    chordLength: number,
    angularGap: number,
): number {
    const safeAngularGap = clamp(angularGap, 0.001, Math.PI * 2 - 0.001);

    return chordLength / (2 * Math.sin(safeAngularGap / 2));
}

function getRadialTangentialExtent(layout: RadialAngleLayout): number {
    const tangentX = -Math.sin(layout.angle);
    const tangentY = Math.cos(layout.angle);

    return (
        Math.abs(tangentX) * layout.visualNodeSize.width +
        Math.abs(tangentY) * layout.visualNodeSize.height
    );
}

function getRadialCollisionChordLengthForPair(
    firstLayout: RadialAngleLayout,
    secondLayout: RadialAngleLayout,
): number {
    const firstTangentialExtent = getRadialTangentialExtent(firstLayout);
    const secondTangentialExtent = getRadialTangentialExtent(secondLayout);

    return (
        (firstTangentialExtent + secondTangentialExtent) / 2 +
        RADIAL_TREE_NODE_ARC_GAP
    );
}

function getRequiredRadiusForAssignedRadialRing(
    layoutsAtDepth: RadialAngleLayout[],
): number {
    if (layoutsAtDepth.length <= 1) {
        return 0;
    }

    const sortedLayouts = [...layoutsAtDepth].sort((a, b) => {
        return normalizeRadialAngle(a.angle) - normalizeRadialAngle(b.angle);
    });

    let requiredRadius = 0;

    for (let index = 0; index < sortedLayouts.length; index += 1) {
        const currentLayout = sortedLayouts[index];
        const nextLayout =
            index === sortedLayouts.length - 1
                ? sortedLayouts[0]
                : sortedLayouts[index + 1];

        const currentAngle = normalizeRadialAngle(currentLayout.angle);
        const rawNextAngle = normalizeRadialAngle(nextLayout.angle);
        const nextAngle =
            index === sortedLayouts.length - 1
                ? rawNextAngle + Math.PI * 2
                : rawNextAngle;

        const angularGap = nextAngle - currentAngle;

        if (angularGap <= 0) {
            continue;
        }

        const chordLength = getRadialCollisionChordLengthForPair(
            currentLayout,
            nextLayout,
        );

        requiredRadius = Math.max(
            requiredRadius,
            getRequiredRadiusForChord(chordLength, angularGap) +
            RADIAL_TREE_RADIUS_SAFETY_PADDING,
        );
    }

    return Math.ceil(requiredRadius);
}

function buildRadialRadiusByDepth(
    radialLayoutsByNodeId: Map<number, RadialAngleLayout>,
): Map<number, number> {
    const layoutsByDepth = groupRadialLayoutsByDepth(radialLayoutsByNodeId);
    const depths = [...layoutsByDepth.keys()];

    if (depths.length === 0) {
        return new Map<number, number>([[0, 0]]);
    }

    const maxDepth = Math.max(...depths);
    const radiusByDepth = new Map<number, number>();

    radiusByDepth.set(0, 0);

    if (maxDepth === 0) {
        return radiusByDepth;
    }

    const rootLayouts = layoutsByDepth.get(0) ?? [];
    const rootVisualNodeSize = rootLayouts[0]?.visualNodeSize ?? {
        width: RADIAL_ROOT_VISUAL_NODE_WIDTH,
        height: RADIAL_ROOT_VISUAL_NODE_HEIGHT,
    };

    let previousRadius = 0;
    let previousMaximumRadialExtent = Math.max(
        rootVisualNodeSize.width,
        rootVisualNodeSize.height,
    );

    for (let depth = 1; depth <= maxDepth; depth += 1) {
        const layoutsAtDepth = layoutsByDepth.get(depth) ?? [];

        if (layoutsAtDepth.length === 0) {
            continue;
        }

        const maximumRadialExtent = getMaximumRadialNodeExtent(layoutsAtDepth);

        const requiredRadiusByCapacity =
            getRadialRingCapacityRadius(layoutsAtDepth);

        const requiredRadiusByRealCollision =
            getRequiredRadiusForAssignedRadialRing(layoutsAtDepth);

        const requiredRadiusByPreviousRing =
            previousRadius +
            previousMaximumRadialExtent / 2 +
            maximumRadialExtent / 2 +
            RADIAL_TREE_RING_GAP;

        const requiredRadiusByFirstRing =
            depth === 1 ? RADIAL_TREE_FIRST_RING_RADIUS_MIN : 0;

        const finalRadius = Math.ceil(
            Math.max(
                requiredRadiusByCapacity,
                requiredRadiusByRealCollision,
                requiredRadiusByPreviousRing,
                requiredRadiusByFirstRing,
            ),
        );

        radiusByDepth.set(depth, finalRadius);

        previousRadius = finalRadius;
        previousMaximumRadialExtent = maximumRadialExtent;
    }

    return radiusByDepth;
}

function materializeRadialPositions(
    radialLayoutsByNodeId: Map<number, RadialAngleLayout>,
    radiusByDepth: Map<number, number>,
    positions: Map<number, LayoutPosition>,
): void {
    for (const [nodeId, radialLayout] of radialLayoutsByNodeId.entries()) {
        const radius = radiusByDepth.get(radialLayout.depth) ?? 0;

        const centerX = Math.cos(radialLayout.angle) * radius;
        const centerY = Math.sin(radialLayout.angle) * radius;

        positions.set(nodeId, {
            x: centerX - radialLayout.visualNodeSize.width / 2,
            y: centerY - radialLayout.visualNodeSize.height / 2,
            depth: radialLayout.depth,
            angle: radialLayout.angle,
        });
    }
}

function layoutRadialRings(
    rootNode: NodeDto,
    childrenByParentId: Map<number, NodeDto[]>,
    positions: Map<number, LayoutPosition>,
): void {
    const radialLayoutsByNodeId = new Map<number, RadialAngleLayout>();
    const leafSlotRef = { value: 0 };

    collectRadialSlotLayouts(
        rootNode,
        0,
        childrenByParentId,
        radialLayoutsByNodeId,
        { value: 0 },
        leafSlotRef,
    );

    assignRadialAnglesByLeafSlot(radialLayoutsByNodeId, leafSlotRef.value);

    const radiusByDepth = buildRadialRadiusByDepth(radialLayoutsByNodeId);

    materializeRadialPositions(
        radialLayoutsByNodeId,
        radiusByDepth,
        positions,
    );
}

function layoutVisibleTree(
    node: NodeDto,
    depth: number,
    childrenByParentId: Map<number, NodeDto[]>,
    positions: Map<number, LayoutPosition>,
    nextRowRef: { value: number },
    layoutDirection: LinearTreeLayoutDirection,
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
        const primaryAxisPosition = depth * levelGap;
        const secondaryAxisPosition = nextRowRef.value * siblingGap;

        const x =
            layoutDirection === 'horizontal'
                ? primaryAxisPosition
                : secondaryAxisPosition;

        const y =
            layoutDirection === 'horizontal'
                ? secondaryAxisPosition
                : primaryAxisPosition;

        positions.set(node.id, { x, y, depth });
        nextRowRef.value += 1;

        return secondaryAxisPosition;
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
    const secondaryAxisPosition = (firstCenter + lastCenter) / 2;
    const primaryAxisPosition = depth * levelGap;

    const x =
        layoutDirection === 'horizontal'
            ? primaryAxisPosition
            : secondaryAxisPosition;

    const y =
        layoutDirection === 'horizontal'
            ? secondaryAxisPosition
            : primaryAxisPosition;

    positions.set(node.id, { x, y, depth });

    return secondaryAxisPosition;
}

function getCardinalPositionForAngle(angle: number): Position {
    const x = Math.cos(angle);
    const y = Math.sin(angle);

    if (Math.abs(x) >= Math.abs(y)) {
        return x >= 0 ? Position.Right : Position.Left;
    }

    return y >= 0 ? Position.Bottom : Position.Top;
}

function getOppositePosition(position: Position): Position {
    if (position === Position.Right) {
        return Position.Left;
    }

    if (position === Position.Left) {
        return Position.Right;
    }

    if (position === Position.Top) {
        return Position.Bottom;
    }

    return Position.Top;
}

function getSourcePosition(
    layoutDirection: VisualTreeLayoutDirection,
    position: LayoutPosition,
): Position {
    if (layoutDirection === 'horizontal') {
        return Position.Right;
    }

    if (layoutDirection === 'vertical') {
        return Position.Bottom;
    }

    if (position.depth === 0 || position.angle === undefined) {
        return Position.Right;
    }

    return getCardinalPositionForAngle(position.angle);
}

function getTargetPosition(
    layoutDirection: VisualTreeLayoutDirection,
    position: LayoutPosition,
): Position {
    if (layoutDirection === 'horizontal') {
        return Position.Left;
    }

    if (layoutDirection === 'vertical') {
        return Position.Top;
    }

    if (position.depth === 0 || position.angle === undefined) {
        return Position.Left;
    }

    return getOppositePosition(getCardinalPositionForAngle(position.angle));
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
    onQuickSetLearningStatus = () => { },
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
    const positions = new Map<number, LayoutPosition>();

    if (layoutDirection === 'radial') {
        layoutRadialRings(rootNode, childrenByParentId, positions);
    } else {
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
    }

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
        const sourceHandlePosition = getSourcePosition(layoutDirection, position);
        const targetHandlePosition = getTargetPosition(layoutDirection, position);

        return {
            id: String(node.id),
            type: 'studyTreeNode',
            position: {
                x: position.x,
                y: position.y,
            },
            sourcePosition: sourceHandlePosition,
            targetPosition: targetHandlePosition,
            draggable: false,
            selectable: false,
            data: {
                nodeId: node.id,
                title: node.title,
                learningStatus: node.learningStatus,
                kindLabel: getKindLabel(position.depth),
                layoutDirection,
                isCompactLayout: layoutDirection === 'radial',
                sourceHandlePosition,
                targetHandlePosition,
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

    const flowEdges: Edge[] = visibleNodes.flatMap((node) => {
        if (node.parentId === null || !visibleNodeIds.has(node.parentId)) {
            return [];
        }

        const parentId = node.parentId;
        const isActiveConnection =
            node.id === selectedNodeId || parentId === selectedNodeId;

        return [
            {
                id: `edge-${parentId}-${node.id}`,
                source: String(parentId),
                target: String(node.id),
                sourceHandle: 'source',
                targetHandle: 'target',
                type: getVisualEdgeType(layoutDirection),
                className: isActiveConnection
                    ? 'is-active-connection'
                    : 'is-passive-connection',
                selectable: false,
                focusable: false,
                animated: false,
                style: {
                    stroke: 'rgba(96, 165, 250, 0.58)',
                    strokeWidth: layoutDirection === 'radial' ? 1.65 : 2.5,
                },
                zIndex: 0,
            },
        ];
    });

    return {
        flowNodes,
        flowEdges,
    };
}