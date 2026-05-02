import { MarkerType, Position, type Edge, type Node } from '@xyflow/react';
import type { NodeDto } from '../../../shared/documents/contracts';

export const VISUAL_NODE_WIDTH = 236;
export const VISUAL_NODE_HEIGHT = 132;

const RADIAL_VISUAL_NODE_WIDTH = 156;
const RADIAL_VISUAL_NODE_HEIGHT = 46;

const RADIAL_ROOT_VISUAL_NODE_WIDTH = 320;
const RADIAL_ROOT_VISUAL_NODE_HEIGHT = 152;

const RADIAL_NODE_TITLE_CHARS_PER_LINE = 20;
const RADIAL_ROOT_TITLE_CHARS_PER_LINE = 23;

const RADIAL_NODE_FIXED_VERTICAL_SPACE = 18;
const RADIAL_ROOT_FIXED_VERTICAL_SPACE = 84;

const RADIAL_NODE_TITLE_LINE_HEIGHT = 13;
const RADIAL_ROOT_TITLE_LINE_HEIGHT = 22;

const HORIZONTAL_GAP = 176;
const VERTICAL_GAP = 68;

const VERTICAL_TREE_HORIZONTAL_GAP_MAX = 64;
const VERTICAL_TREE_HORIZONTAL_GAP_MIN = 18;

const VERTICAL_TREE_VERTICAL_GAP_MIN = 96;
const VERTICAL_TREE_VERTICAL_GAP_MAX = 176;

const RADIAL_TREE_FIRST_RING_RADIUS_MIN = 0;
const RADIAL_TREE_RING_GAP = 18;
const RADIAL_TREE_NODE_ARC_GAP = 6;
const RADIAL_TREE_RADIUS_SAFETY_PADDING = 4;
const RADIAL_TREE_ELLIPSE_X_SCALE = 1.34;
const RADIAL_TREE_ELLIPSE_Y_SCALE = 0.76;
const RADIAL_TREE_DENSE_RING_TARGET_NODES_PER_LANE = 96;
const RADIAL_TREE_DENSE_RING_MAX_LANES = 3;
const RADIAL_TREE_DENSE_RING_LANE_GAP = 132;
const RADIAL_EDGE_HANDLES_PER_SIDE = 3;
const RADIAL_EDGE_HANDLE_MIN_RATIO = 0.25;
const RADIAL_EDGE_HANDLE_MAX_RATIO = 0.75;
const RADIAL_EDGE_BRANCH_PALETTE = [
    { r: 96, g: 165, b: 250 },
    { r: 45, g: 212, b: 191 },
    { r: 167, g: 139, b: 250 },
    { r: 251, g: 146, b: 60 },
    { r: 74, g: 222, b: 128 },
    { r: 244, g: 114, b: 182 },
    { r: 56, g: 189, b: 248 },
    { r: 250, g: 204, b: 21 },
    { r: 129, g: 140, b: 248 },
    { r: 248, g: 113, b: 113 },
];



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
    radius: number;
    laneOffset: number;
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
    isSearchMatch?: boolean;
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
    onHoverNode?: (nodeId: number) => void;
    onClearHoverNode?: () => void;
};

export type StudyTreeFlowNode = Node<StudyTreeNodeData, 'studyTreeNode'>;

interface BuildVisualTreeInput {
    nodes: NodeDto[];
    rootNodeId: number;
    selectedNodeId: number;
    hoveredNodeId?: number | null;
    searchMatchNodeIds?: Set<number>;
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
    onHoverNode?: (nodeId: number) => void;
    onClearHoverNode?: () => void;
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
        return 'Raíz';
    }

    return `Nivel ${depth}`;
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
            radius: 0,
            laneOffset: 0,
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
        radius: 0,
        laneOffset: 0,
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

function normalizeRadialAngle(angle: number): number {
    const fullCircle = Math.PI * 2;
    const normalizedAngle = angle % fullCircle;

    return normalizedAngle < 0 ? normalizedAngle + fullCircle : normalizedAngle;
}

function getRadialLaneCount(layoutsAtDepth: RadialAngleLayout[]): number {
    return clamp(
        Math.ceil(
            layoutsAtDepth.length / RADIAL_TREE_DENSE_RING_TARGET_NODES_PER_LANE,
        ),
        1,
        RADIAL_TREE_DENSE_RING_MAX_LANES,
    );
}

function getRadialSiblingLaneIndex(
    siblingIndex: number,
    siblingCount: number,
    laneCount: number,
): number {
    if (laneCount <= 1) {
        return 0;
    }

    if (siblingCount <= 1) {
        return Math.floor((laneCount - 1) / 2);
    }

    if (laneCount === 2) {
        return siblingIndex % 2;
    }

    const laneOrder = [1, 0, 2];
    return laneOrder[siblingIndex % laneOrder.length];
}

function assignRadialLaneOffsets(layoutsAtDepth: RadialAngleLayout[]): void {
    const laneCount = getRadialLaneCount(layoutsAtDepth);
    const sortedLayouts = [...layoutsAtDepth].sort((a, b) => {
        return normalizeRadialAngle(a.angle) - normalizeRadialAngle(b.angle);
    });

    let siblingGroupStart = 0;

    while (siblingGroupStart < sortedLayouts.length) {
        const parentId = sortedLayouts[siblingGroupStart].node.parentId;
        let siblingGroupEnd = siblingGroupStart + 1;

        while (
            siblingGroupEnd < sortedLayouts.length &&
            sortedLayouts[siblingGroupEnd].node.parentId === parentId
        ) {
            siblingGroupEnd += 1;
        }

        const siblingCount = siblingGroupEnd - siblingGroupStart;

        for (let index = siblingGroupStart; index < siblingGroupEnd; index += 1) {
            const layout = sortedLayouts[index];

            if (laneCount <= 1) {
                layout.laneOffset = 0;
                continue;
            }

            const laneIndex = getRadialSiblingLaneIndex(
                index - siblingGroupStart,
                siblingCount,
                laneCount,
            );
            layout.laneOffset =
                (laneIndex - (laneCount - 1) / 2) *
                RADIAL_TREE_DENSE_RING_LANE_GAP;
        }

        siblingGroupStart = siblingGroupEnd;
    }
}

function getRadialLaneRadius(
    layout: RadialAngleLayout,
    baseRadius: number,
): number {
    return Math.max(0, baseRadius + layout.laneOffset);
}

function getRadialEllipseCenter(layout: RadialAngleLayout, radius: number): {
    x: number;
    y: number;
} {
    return {
        x: Math.cos(layout.angle) * radius * RADIAL_TREE_ELLIPSE_X_SCALE,
        y: Math.sin(layout.angle) * radius * RADIAL_TREE_ELLIPSE_Y_SCALE,
    };
}

function areRadialLayoutsSeparatedAtRadii(
    firstLayout: RadialAngleLayout,
    firstRadius: number,
    secondLayout: RadialAngleLayout,
    secondRadius: number,
): boolean {
    const firstCenter = getRadialEllipseCenter(firstLayout, firstRadius);
    const secondCenter = getRadialEllipseCenter(secondLayout, secondRadius);

    const horizontalSeparation = Math.abs(secondCenter.x - firstCenter.x);
    const verticalSeparation = Math.abs(secondCenter.y - firstCenter.y);

    const requiredHorizontalSeparation =
        (firstLayout.visualNodeSize.width + secondLayout.visualNodeSize.width) /
        2 +
        RADIAL_TREE_NODE_ARC_GAP;

    const requiredVerticalSeparation =
        (firstLayout.visualNodeSize.height + secondLayout.visualNodeSize.height) /
        2 +
        RADIAL_TREE_NODE_ARC_GAP;

    return (
        horizontalSeparation >= requiredHorizontalSeparation ||
        verticalSeparation >= requiredVerticalSeparation
    );
}

function areRadialLayoutsSeparatedAtRadius(
    firstLayout: RadialAngleLayout,
    secondLayout: RadialAngleLayout,
    baseRadius: number,
): boolean {
    return areRadialLayoutsSeparatedAtRadii(
        firstLayout,
        getRadialLaneRadius(firstLayout, baseRadius),
        secondLayout,
        getRadialLaneRadius(secondLayout, baseRadius),
    );
}

function areRadialLayoutsSeparatedFromPlacedLayoutsAtRadius(
    layoutsAtDepth: RadialAngleLayout[],
    placedLayouts: RadialAngleLayout[],
    baseRadius: number,
): boolean {
    for (const layout of layoutsAtDepth) {
        for (const placedLayout of placedLayouts) {
            if (
                !areRadialLayoutsSeparatedAtRadii(
                    layout,
                    getRadialLaneRadius(layout, baseRadius),
                    placedLayout,
                    placedLayout.radius,
                )
            ) {
                return false;
            }
        }
    }

    return true;
}

function getRequiredRadiusAgainstPlacedRadialLayouts(
    layoutsAtDepth: RadialAngleLayout[],
    placedLayouts: RadialAngleLayout[],
    minimumRadius: number,
): number {
    if (layoutsAtDepth.length === 0 || placedLayouts.length === 0) {
        return minimumRadius;
    }

    let lowerRadius = minimumRadius;
    let upperRadius = Math.max(minimumRadius, 1);
    let expansionCount = 0;

    while (
        !areRadialLayoutsSeparatedFromPlacedLayoutsAtRadius(
            layoutsAtDepth,
            placedLayouts,
            upperRadius,
        ) &&
        expansionCount < 20
    ) {
        lowerRadius = upperRadius;
        upperRadius *= 2;
        expansionCount += 1;
    }

    for (let iteration = 0; iteration < 16; iteration += 1) {
        const middleRadius = (lowerRadius + upperRadius) / 2;

        if (
            areRadialLayoutsSeparatedFromPlacedLayoutsAtRadius(
                layoutsAtDepth,
                placedLayouts,
                middleRadius,
            )
        ) {
            upperRadius = middleRadius;
        } else {
            lowerRadius = middleRadius;
        }
    }

    return upperRadius + RADIAL_TREE_RADIUS_SAFETY_PADDING;
}

function getRequiredRadiusForRadialLayoutPair(
    firstLayout: RadialAngleLayout,
    secondLayout: RadialAngleLayout,
): number {
    let lowerRadius = 0;
    let upperRadius = Math.max(
        firstLayout.visualNodeSize.width,
        firstLayout.visualNodeSize.height,
        secondLayout.visualNodeSize.width,
        secondLayout.visualNodeSize.height,
    );

    let expansionCount = 0;

    while (
        !areRadialLayoutsSeparatedAtRadius(firstLayout, secondLayout, upperRadius) &&
        expansionCount < 20
    ) {
        lowerRadius = upperRadius;
        upperRadius *= 2;
        expansionCount += 1;
    }

    for (let iteration = 0; iteration < 16; iteration += 1) {
        const middleRadius = (lowerRadius + upperRadius) / 2;

        if (
            areRadialLayoutsSeparatedAtRadius(
                firstLayout,
                secondLayout,
                middleRadius,
            )
        ) {
            upperRadius = middleRadius;
        } else {
            lowerRadius = middleRadius;
        }
    }

    return upperRadius;
}

function getRequiredRadiusForAssignedRadialRing(
    layoutsAtDepth: RadialAngleLayout[],
): number {
    if (layoutsAtDepth.length <= 1) {
        return 0;
    }

    let requiredRadius = 0;

    for (let index = 0; index < layoutsAtDepth.length; index += 1) {
        const currentLayout = layoutsAtDepth[index];

        for (
            let nextIndex = index + 1;
            nextIndex < layoutsAtDepth.length;
            nextIndex += 1
        ) {
            const nextLayout = layoutsAtDepth[nextIndex];

            requiredRadius = Math.max(
                requiredRadius,
                getRequiredRadiusForRadialLayoutPair(
                    currentLayout,
                    nextLayout,
                ) + RADIAL_TREE_RADIUS_SAFETY_PADDING,
            );
        }
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
    const placedLayouts = [...rootLayouts];

    for (const rootLayout of rootLayouts) {
        rootLayout.radius = 0;
    }

    let previousRadius = 0;

    for (let depth = 1; depth <= maxDepth; depth += 1) {
        const layoutsAtDepth = layoutsByDepth.get(depth) ?? [];

        if (layoutsAtDepth.length === 0) {
            continue;
        }

        assignRadialLaneOffsets(layoutsAtDepth);

        const minimumLaneOffset = Math.min(
            ...layoutsAtDepth.map((layout) => layout.laneOffset),
        );

        const requiredRadiusByRealCollision =
            getRequiredRadiusForAssignedRadialRing(layoutsAtDepth);

        const minimumRadiusByRingOrder =
            previousRadius + RADIAL_TREE_RING_GAP - minimumLaneOffset;

        const requiredRadiusByPlacedLayouts =
            getRequiredRadiusAgainstPlacedRadialLayouts(
                layoutsAtDepth,
                placedLayouts,
                minimumRadiusByRingOrder,
            );

        const requiredRadiusByFirstRing =
            depth === 1 ? RADIAL_TREE_FIRST_RING_RADIUS_MIN : 0;

        const finalRadius = Math.ceil(
            Math.max(
                requiredRadiusByRealCollision,
                requiredRadiusByPlacedLayouts,
                requiredRadiusByFirstRing,
            ),
        );

        radiusByDepth.set(depth, finalRadius);

        for (const layout of layoutsAtDepth) {
            layout.radius = getRadialLaneRadius(layout, finalRadius);
        }

        placedLayouts.push(...layoutsAtDepth);
        previousRadius = Math.max(...layoutsAtDepth.map((layout) => layout.radius));
    }

    return radiusByDepth;
}

function materializeRadialPositions(
    radialLayoutsByNodeId: Map<number, RadialAngleLayout>,
    radiusByDepth: Map<number, number>,
    positions: Map<number, LayoutPosition>,
): void {
    for (const [nodeId, radialLayout] of radialLayoutsByNodeId.entries()) {
        const radius =
            radialLayout.depth === 0
                ? radiusByDepth.get(radialLayout.depth) ?? 0
                : radialLayout.radius;

        const center = getRadialEllipseCenter(radialLayout, radius);

        positions.set(nodeId, {
            x: center.x - radialLayout.visualNodeSize.width / 2,
            y: center.y - radialLayout.visualNodeSize.height / 2,
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

    return getCardinalPositionForVector(x, y);
}

function getCardinalPositionForVector(x: number, y: number): Position {
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

function getHandleRatio(handleIndex: number): number {
    if (RADIAL_EDGE_HANDLES_PER_SIDE <= 1) {
        return 0.5;
    }

    const step =
        (RADIAL_EDGE_HANDLE_MAX_RATIO - RADIAL_EDGE_HANDLE_MIN_RATIO) /
        (RADIAL_EDGE_HANDLES_PER_SIDE - 1);

    return RADIAL_EDGE_HANDLE_MIN_RATIO + handleIndex * step;
}

function getHandleId(
    handleType: 'source' | 'target',
    position: Position,
    handleIndex: number,
): string {
    return `${handleType}-${position}-${handleIndex}`;
}

function getRadialHandlePoint(
    node: NodeDto,
    position: LayoutPosition,
    layoutDirection: VisualTreeLayoutDirection,
    side: Position,
    handleIndex: number,
): {
    x: number;
    y: number;
} {
    const nodeSize = getVisualNodeSizeForPosition(
        node,
        position,
        layoutDirection,
    );
    const center = getLayoutCenter(node, position, layoutDirection);
    const ratio = getHandleRatio(handleIndex);
    const left = center.x - nodeSize.width / 2;
    const top = center.y - nodeSize.height / 2;

    if (side === Position.Left) {
        return {
            x: left,
            y: top + nodeSize.height * ratio,
        };
    }

    if (side === Position.Right) {
        return {
            x: left + nodeSize.width,
            y: top + nodeSize.height * ratio,
        };
    }

    if (side === Position.Top) {
        return {
            x: left + nodeSize.width * ratio,
            y: top,
        };
    }

    return {
        x: left + nodeSize.width * ratio,
        y: top + nodeSize.height,
    };
}

function getRadialHandleOutwardVector(side: Position): {
    x: number;
    y: number;
} {
    if (side === Position.Left) {
        return { x: -1, y: 0 };
    }

    if (side === Position.Right) {
        return { x: 1, y: 0 };
    }

    if (side === Position.Top) {
        return { x: 0, y: -1 };
    }

    return { x: 0, y: 1 };
}

function getNormalizedVector(
    fromPoint: {
        x: number;
        y: number;
    },
    toPoint: {
        x: number;
        y: number;
    },
): {
    x: number;
    y: number;
} {
    const deltaX = toPoint.x - fromPoint.x;
    const deltaY = toPoint.y - fromPoint.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance < 0.001) {
        return { x: 0, y: 0 };
    }

    return {
        x: deltaX / distance,
        y: deltaY / distance,
    };
}

function getRadialHandleDirectionPenalty(
    handleSide: Position,
    direction: {
        x: number;
        y: number;
    },
    mode: 'source' | 'target',
): number {
    const outwardVector = getRadialHandleOutwardVector(handleSide);
    const directionScore =
        outwardVector.x * direction.x + outwardVector.y * direction.y;
    const desiredScore = mode === 'source' ? directionScore : -directionScore;

    return Math.max(0, 1 - desiredScore) * 360;
}

function getRadialHandleAxisAlignmentPenalty(
    sourceSide: Position,
    sourcePoint: {
        x: number;
        y: number;
    },
    targetSide: Position,
    targetPoint: {
        x: number;
        y: number;
    },
): number {
    const sourceIsHorizontalSide =
        sourceSide === Position.Left || sourceSide === Position.Right;
    const targetIsHorizontalSide =
        targetSide === Position.Left || targetSide === Position.Right;

    if (sourceIsHorizontalSide && targetIsHorizontalSide) {
        return Math.abs(sourcePoint.y - targetPoint.y) * 0.38;
    }

    if (!sourceIsHorizontalSide && !targetIsHorizontalSide) {
        return Math.abs(sourcePoint.x - targetPoint.x) * 0.38;
    }

    return 0;
}

function getRadialHandlePair(
    sourceNode: NodeDto,
    sourcePosition: LayoutPosition,
    targetNode: NodeDto,
    targetPosition: LayoutPosition,
    layoutDirection: VisualTreeLayoutDirection,
): {
    sourceSide: Position;
    sourceHandleIndex: number;
    targetSide: Position;
    targetHandleIndex: number;
} {
    const handleSides = [
        Position.Top,
        Position.Right,
        Position.Bottom,
        Position.Left,
    ];
    const sourceCenter = getLayoutCenter(
        sourceNode,
        sourcePosition,
        layoutDirection,
    );
    const targetCenter = getLayoutCenter(
        targetNode,
        targetPosition,
        layoutDirection,
    );
    const centerDirection = getNormalizedVector(sourceCenter, targetCenter);
    let bestPair = {
        sourceSide: getRadialHandleSideForRay(
            sourceNode,
            sourcePosition,
            layoutDirection,
            targetCenter,
        ),
        sourceHandleIndex: 0,
        targetSide: getRadialHandleSideForRay(
            targetNode,
            targetPosition,
            layoutDirection,
            sourceCenter,
        ),
        targetHandleIndex: 0,
    };
    let bestScore = Number.POSITIVE_INFINITY;

    for (const sourceSide of handleSides) {
        for (
            let sourceHandleIndex = 0;
            sourceHandleIndex < RADIAL_EDGE_HANDLES_PER_SIDE;
            sourceHandleIndex += 1
        ) {
            const sourcePoint = getRadialHandlePoint(
                sourceNode,
                sourcePosition,
                layoutDirection,
                sourceSide,
                sourceHandleIndex,
            );

            for (const targetSide of handleSides) {
                for (
                    let targetHandleIndex = 0;
                    targetHandleIndex < RADIAL_EDGE_HANDLES_PER_SIDE;
                    targetHandleIndex += 1
                ) {
                    const targetPoint = getRadialHandlePoint(
                        targetNode,
                        targetPosition,
                        layoutDirection,
                        targetSide,
                        targetHandleIndex,
                    );
                    const edgeDirection = getNormalizedVector(
                        sourcePoint,
                        targetPoint,
                    );
                    const distance = Math.hypot(
                        targetPoint.x - sourcePoint.x,
                        targetPoint.y - sourcePoint.y,
                    );
                    const directionPenalty =
                        getRadialHandleDirectionPenalty(
                            sourceSide,
                            edgeDirection,
                            'source',
                        ) +
                        getRadialHandleDirectionPenalty(
                            targetSide,
                            edgeDirection,
                            'target',
                        );
                    const centerDirectionPenalty =
                        Math.max(
                            0,
                            1 -
                            (edgeDirection.x * centerDirection.x +
                                edgeDirection.y * centerDirection.y),
                        ) * 120;
                    const axisAlignmentPenalty =
                        getRadialHandleAxisAlignmentPenalty(
                            sourceSide,
                            sourcePoint,
                            targetSide,
                            targetPoint,
                        );
                    const score =
                        distance +
                        directionPenalty +
                        centerDirectionPenalty +
                        axisAlignmentPenalty;

                    if (score < bestScore) {
                        bestScore = score;
                        bestPair = {
                            sourceSide,
                            sourceHandleIndex,
                            targetSide,
                            targetHandleIndex,
                        };
                    }
                }
            }
        }
    }

    return bestPair;
}

function getVisualNodeSizeForPosition(
    node: NodeDto,
    position: LayoutPosition,
    layoutDirection: VisualTreeLayoutDirection,
): VisualNodeSize {
    if (layoutDirection === 'radial') {
        return getRadialVisualNodeSize(node, position.depth);
    }

    return {
        width: VISUAL_NODE_WIDTH,
        height: VISUAL_NODE_HEIGHT,
    };
}

function getLayoutCenter(
    node: NodeDto,
    position: LayoutPosition,
    layoutDirection: VisualTreeLayoutDirection,
): {
    x: number;
    y: number;
} {
    const visualNodeSize = getVisualNodeSizeForPosition(
        node,
        position,
        layoutDirection,
    );

    return {
        x: position.x + visualNodeSize.width / 2,
        y: position.y + visualNodeSize.height / 2,
    };
}

function getRadialHandleSideForRay(
    node: NodeDto,
    position: LayoutPosition,
    layoutDirection: VisualTreeLayoutDirection,
    otherCenter: {
        x: number;
        y: number;
    },
): Position {
    const nodeSize = getVisualNodeSizeForPosition(
        node,
        position,
        layoutDirection,
    );
    const center = getLayoutCenter(node, position, layoutDirection);
    const deltaX = otherCenter.x - center.x;
    const deltaY = otherCenter.y - center.y;
    const xTravel = Math.abs(deltaX) > 0.001
        ? nodeSize.width / 2 / Math.abs(deltaX)
        : Number.POSITIVE_INFINITY;
    const yTravel = Math.abs(deltaY) > 0.001
        ? nodeSize.height / 2 / Math.abs(deltaY)
        : Number.POSITIVE_INFINITY;

    if (xTravel < yTravel) {
        return deltaX >= 0 ? Position.Right : Position.Left;
    }

    return deltaY >= 0 ? Position.Bottom : Position.Top;
}

function getColorWithDepthLightness(
    color: {
        r: number;
        g: number;
        b: number;
    },
    depth: number,
): {
    r: number;
    g: number;
    b: number;
} {
    const lightnessRatio = Math.min(0.24, Math.max(0, depth - 1) * 0.055);

    return {
        r: Math.round(color.r + (255 - color.r) * lightnessRatio),
        g: Math.round(color.g + (255 - color.g) * lightnessRatio),
        b: Math.round(color.b + (255 - color.b) * lightnessRatio),
    };
}

function getRgbaColor(
    color: {
        r: number;
        g: number;
        b: number;
    },
    alpha: number,
): string {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function getRadialBranchEdgeColor(
    branchIndex: number | undefined,
    depth: number,
    isActiveConnection: boolean,
): string {
    if (branchIndex === undefined) {
        return isActiveConnection
            ? 'rgba(147, 197, 253, 0.92)'
            : 'rgba(96, 165, 250, 0.7)';
    }

    const baseColor =
        RADIAL_EDGE_BRANCH_PALETTE[
        branchIndex % RADIAL_EDGE_BRANCH_PALETTE.length
        ];
    const depthColor = getColorWithDepthLightness(baseColor, depth);
    const alpha = isActiveConnection
        ? 0.92
        : Math.max(0.44, 0.7 - Math.max(0, depth - 1) * 0.04);

    return getRgbaColor(depthColor, alpha);
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
    hoveredNodeId = null,
    searchMatchNodeIds,
    isBusy,
    layoutDirection = 'horizontal',
    onSelectNode,
    onOpenDetailsWorkspace,
    onToggleCollapse,
    onQuickCreateChild,
    onQuickDeleteLeaf,
    onQuickSetLearningStatus = () => { },
    onHoverNode,
    onClearHoverNode,
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

    const resolvedRootNodeId = rootNode.id;
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
    const rootChildren = childrenByParentId.get(resolvedRootNodeId) ?? [];
    const rootBranchIndexById = new Map<number, number>();
    const rootBranchIdByNodeId = new Map<number, number | null>();
    const hoverPathNodeIds = new Set<number>();
    const hoverChildNodeIds = new Set<number>();
    const hoverGrandchildNodeIds = new Set<number>();

    rootChildren.forEach((child, index) => {
        rootBranchIndexById.set(child.id, index);
    });

    if (layoutDirection === 'radial' && hoveredNodeId !== null) {
        let currentNode = nodesById.get(hoveredNodeId) ?? null;

        while (currentNode) {
            hoverPathNodeIds.add(currentNode.id);

            if (currentNode.parentId === null) {
                break;
            }

            currentNode = nodesById.get(currentNode.parentId) ?? null;
        }

        for (const child of childrenByParentId.get(hoveredNodeId) ?? []) {
            hoverChildNodeIds.add(child.id);

            for (const grandchild of childrenByParentId.get(child.id) ?? []) {
                hoverGrandchildNodeIds.add(grandchild.id);
            }
        }
    }

    function getRootBranchId(node: NodeDto): number | null {
        const cachedRootBranchId = rootBranchIdByNodeId.get(node.id);

        if (cachedRootBranchId !== undefined) {
            return cachedRootBranchId;
        }

        if (node.parentId === null) {
            rootBranchIdByNodeId.set(node.id, null);
            return null;
        }

        if (node.parentId === resolvedRootNodeId) {
            rootBranchIdByNodeId.set(node.id, node.id);
            return node.id;
        }

        const parentNode = nodesById.get(node.parentId);
        const rootBranchId = parentNode ? getRootBranchId(parentNode) : null;

        rootBranchIdByNodeId.set(node.id, rootBranchId);
        return rootBranchId;
    }

    const flowNodes: StudyTreeFlowNode[] = visibleNodes.map((node) => {
        const position = positions.get(node.id);

        if (!position) {
            throw new Error(`No se pudo calcular la posición visual del nodo ${node.id}`);
        }

        const isActive = selectedNodeId === node.id;
        const isDirectParentOfSelected = selectedNode?.parentId === node.id;
        const isDirectChildOfSelected = node.parentId === selectedNodeId;
        const isContextual = !isActive && (isDirectParentOfSelected || isDirectChildOfSelected);
        const isSearchMatch = searchMatchNodeIds?.has(node.id) ?? false;
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
            zIndex: isActive
                ? 1200
                : isSearchMatch
                    ? 700
                    : isContextual
                        ? 500
                        : position.depth,
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
                isSearchMatch,
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
                onHoverNode,
                onClearHoverNode,
            },
        };
    });

    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
    const searchPathEdgeIds = new Set<string>();
    const activeSearchPathEdgeIds = new Set<string>();

    const collectPathEdgeIds = (nodeId: number, output: Set<string>) => {
        let currentNode = nodesById.get(nodeId);

        while (currentNode?.parentId !== null && currentNode?.parentId !== undefined) {
            const parentId = currentNode.parentId;

            if (!visibleNodeIds.has(parentId) || !visibleNodeIds.has(currentNode.id)) {
                break;
            }

            output.add(`edge-${parentId}-${currentNode.id}`);
            currentNode = nodesById.get(parentId);
        }
    };

    for (const nodeId of searchMatchNodeIds ?? []) {
        collectPathEdgeIds(nodeId, searchPathEdgeIds);
    }

    if (searchMatchNodeIds?.has(selectedNodeId)) {
        collectPathEdgeIds(selectedNodeId, activeSearchPathEdgeIds);
    }

    const flowEdges: Edge[] = visibleNodes.flatMap((node) => {
        if (node.parentId === null || !visibleNodeIds.has(node.parentId)) {
            return [];
        }

        const parentId = node.parentId;
        const edgeId = `edge-${parentId}-${node.id}`;
        const isSearchPathConnection = searchPathEdgeIds.has(edgeId);
        const isSearchActivePathConnection = activeSearchPathEdgeIds.has(edgeId);
        const isActiveConnection =
            node.id === selectedNodeId || parentId === selectedNodeId;
        const parentNode = nodesById.get(parentId);
        const parentPosition = positions.get(parentId);
        const childPosition = positions.get(node.id);
        const hasHoveredNode =
            layoutDirection === 'radial' && hoveredNodeId !== null;
        const isHoverPathConnection =
            hasHoveredNode &&
            hoverPathNodeIds.has(parentId) &&
            hoverPathNodeIds.has(node.id);
        const isHoverChildConnection =
            hasHoveredNode && parentId === hoveredNodeId;
        const isHoverGrandchildConnection =
            hasHoveredNode && hoverChildNodeIds.has(parentId);
        const isHoverRelatedConnection =
            isHoverPathConnection ||
            isHoverChildConnection ||
            isHoverGrandchildConnection;
        const rootBranchId = getRootBranchId(node);
        const rootBranchIndex =
            rootBranchId === null
                ? undefined
                : rootBranchIndexById.get(rootBranchId);
        const edgeColor =
            isSearchActivePathConnection
                ? 'rgba(191, 219, 254, 0.92)'
                : isSearchPathConnection
                    ? 'rgba(250, 204, 21, 0.82)'
                    : layoutDirection === 'radial'
                ? getRadialBranchEdgeColor(
                    rootBranchIndex,
                    childPosition?.depth ?? 1,
                    isActiveConnection || isHoverPathConnection,
                )
                : 'rgba(96, 165, 250, 0.58)';
        const edgeOpacity = hasHoveredNode
            ? isHoverRelatedConnection
                ? isHoverGrandchildConnection
                    ? 0.68
                    : 1
                : 0.32
            : 1;
        const radialEdgeWidth = isHoverPathConnection
            ? 2.35
            : isSearchActivePathConnection
                ? 2.7
                : isSearchPathConnection
                    ? 2.35
            : isHoverChildConnection
                ? 2.15
                : isHoverGrandchildConnection
                    ? 2.35
                    : 2.15;
        let radialSourceHandle: string | undefined;
        let radialTargetHandle: string | undefined;

        if (
            layoutDirection === 'radial' &&
            parentNode &&
            parentPosition &&
            childPosition
        ) {
            const handlePair = getRadialHandlePair(
                parentNode,
                parentPosition,
                node,
                childPosition,
                layoutDirection,
            );

            radialSourceHandle = getHandleId(
                'source',
                handlePair.sourceSide,
                handlePair.sourceHandleIndex,
            );
            radialTargetHandle = getHandleId(
                'target',
                handlePair.targetSide,
                handlePair.targetHandleIndex,
            );
        }

        return [
            {
                id: edgeId,
                source: String(parentId),
                target: String(node.id),
                sourceHandle: radialSourceHandle ?? 'source',
                targetHandle: radialTargetHandle ?? 'target',
                type: getVisualEdgeType(layoutDirection),
                className: [
                    isActiveConnection
                        ? 'is-active-connection'
                        : 'is-passive-connection',
                    isHoverPathConnection ? 'is-hover-path-connection' : '',
                    isHoverChildConnection ? 'is-hover-child-connection' : '',
                    isHoverGrandchildConnection
                        ? 'is-hover-grandchild-connection'
                        : '',
                    isSearchPathConnection ? 'is-search-path-connection' : '',
                    isSearchActivePathConnection
                        ? 'is-search-active-path-connection'
                        : '',
                    hasHoveredNode && !isHoverRelatedConnection
                        ? 'is-hover-dimmed-connection'
                        : '',
                ]
                    .filter(Boolean)
                    .join(' '),
                selectable: false,
                focusable: false,
                animated: false,
                style: {
                    '--tree-edge-color': edgeColor,
                    '--tree-edge-width': layoutDirection === 'radial' ? `${radialEdgeWidth}px` : '3.1px',
                    '--tree-edge-width-active': layoutDirection === 'radial' ? `${Math.max(radialEdgeWidth, 2.45)}px` : '3.8px',
                    '--tree-edge-width-passive': layoutDirection === 'radial' ? `${radialEdgeWidth}px` : '2.5px',
                    opacity: edgeOpacity,
                    stroke: edgeColor,
                    strokeWidth: layoutDirection === 'radial' ? radialEdgeWidth : 3.1,
                } as Edge['style'],
                markerEnd:
                    layoutDirection === 'radial'
                        ? {
                            type: MarkerType.ArrowClosed,
                            width: isSearchActivePathConnection || isActiveConnection ? 14 : 10,
                            height: isSearchActivePathConnection || isActiveConnection ? 14 : 10,
                            color: edgeColor,
                        }
                        : undefined,
                zIndex: isSearchActivePathConnection ? 80 : isSearchPathConnection ? 60 : 0,
            },
        ];
    });

    return {
        flowNodes,
        flowEdges,
    };
}
