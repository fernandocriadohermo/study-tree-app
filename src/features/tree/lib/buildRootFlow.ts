import type { Edge, Node } from '@xyflow/react';
import type { RootTreeViewModel } from '../model';

export interface RootNodeData extends Record<string, unknown> {
    title: string;
    learningStatus: 'sin_ver' | 'visto' | 'en_estudio' | 'dominado';
}

export type RootFlowNode = Node<RootNodeData, 'rootNode'>;

export interface RootFlowSnapshot {
    nodes: RootFlowNode[];
    edges: Edge[];
    selectedNodeId: string;
}

export function buildRootFlow(viewModel: RootTreeViewModel): RootFlowSnapshot {
    const selectedNodeId = String(
        viewModel.selectedNodeId ?? viewModel.rootNodeId,
    );

    const nodes: RootFlowNode[] = [
        {
            id: String(viewModel.rootNode.id),
            type: 'rootNode',
            position: { x: 120, y: 120 },
            selected: String(viewModel.rootNode.id) === selectedNodeId,
            draggable: false,
            selectable: true,
            connectable: false,
            data: {
                title: viewModel.rootNode.title,
                learningStatus: viewModel.rootNode.learningStatus,
            },
        },
    ];

    return {
        nodes,
        edges: [],
        selectedNodeId,
    };
}