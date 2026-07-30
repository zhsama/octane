import type { EdgeBase, EdgePosition, NodeBase, Position, Rect, XYPosition } from '@xyflow/system';
import type { Properties } from 'csstype';
import type { OctaneNode } from 'octane';

type CSSProperties = Properties<string | number>;

export type { EdgeBase, EdgePosition, NodeBase, Position, Rect, XYPosition };
export type AvoidArea = Rect;

export type DiagonalMovement = 'Always' | 'Never';

export interface GridNode {
	x: number;
	y: number;
	walkable: boolean;
	costFromStart?: number;
	heuristicCostToGoal?: number;
	estimatedTotalCost?: number;
	opened?: boolean;
	closed?: boolean;
	parent?: GridNode;
}

export interface Grid {
	width: number;
	height: number;
	nodes: GridNode[][];
	getNodeAt: (x: number, y: number) => GridNode;
	isWalkableAt: (x: number, y: number) => boolean;
	setWalkableAt: (x: number, y: number, walkable: boolean) => void;
	getNeighbors: (node: GridNode, diagonalMovement: DiagonalMovement) => GridNode[];
	isInside: (x: number, y: number) => boolean;
	clone: () => Grid;
}

export interface EndpointInfo extends XYPosition {
	position: Position;
}

export interface NodeBoundingBox {
	id: string;
	width: number;
	height: number;
	topLeft: XYPosition;
	bottomLeft: XYPosition;
	topRight: XYPosition;
	bottomRight: XYPosition;
}

export interface GraphBoundingBox {
	width: number;
	height: number;
	topLeft: XYPosition;
	bottomLeft: XYPosition;
	topRight: XYPosition;
	bottomRight: XYPosition;
	xMax: number;
	yMax: number;
	xMin: number;
	yMin: number;
}

export type PointInfo = EndpointInfo;

export type PathFindingFunction = (grid: Grid, start: XYPosition, end: XYPosition) => number[][];

export type SVGDrawFunction = (source: XYPosition, target: XYPosition, path: number[][]) => string;

export type SVGSimpleBezierDrawFunction = (
	source: EndpointInfo,
	target: EndpointInfo,
	path: number[][],
) => string;

export type DrawEdgeFunction = SVGDrawFunction | SVGSimpleBezierDrawFunction;

export interface SmoothStepOptions {
	borderRadius?: number;
}

export interface GetSmartEdgeOptions {
	gridRatio?: number;
	nodePadding?: number;
	drawEdge?: DrawEdgeFunction;
	generatePath?: PathFindingFunction;
	avoidAreas?: Rect[];
}

export type EdgeParams = EdgePosition;

export type GetSmartEdgeParams<
	NodeDataType extends Record<string, unknown> = Record<string, unknown>,
	NodeType extends NodeBase<NodeDataType> = NodeBase<NodeDataType>,
> = EdgeParams & {
	options?: GetSmartEdgeOptions;
	nodes: NodeType[];
};

export interface GetSmartEdgeReturn {
	svgPathString: string;
	edgeCenterX: number;
	edgeCenterY: number;
	points: number[][];
}

export type GetSmartEdgeWaypointsParams<
	NodeDataType extends Record<string, unknown> = Record<string, unknown>,
	NodeType extends NodeBase<NodeDataType> = NodeBase<NodeDataType>,
> = GetSmartEdgeParams<NodeDataType, NodeType> & {
	waypoints: XYPosition[];
};

export interface FloatingEdgeParams {
	sx: number;
	sy: number;
	tx: number;
	ty: number;
	sourcePos: Position;
	targetPos: Position;
}

export interface SmartEdgeLabelProps {
	x: number;
	y: number;
	label: OctaneNode;
	labelStyle?: CSSProperties;
	labelShowBg?: boolean;
	labelBgStyle?: CSSProperties;
	labelBgPadding?: readonly [number, number];
	labelBgBorderRadius?: number;
}

export type SmartEdgeFallback = (props: Readonly<SmartEdgeFallbackProps>) => OctaneNode;

export interface SmartEdgeOptions extends GetSmartEdgeOptions {
	fallback?: SmartEdgeFallback;
}

export interface SmartEdgeFallbackProps extends EdgePosition {
	id: string;
	source: string;
	target: string;
	path: string;
	style?: CSSProperties;
	className?: string;
	markerStart?: string;
	markerEnd?: string;
	interactionWidth?: number;
	label?: OctaneNode;
	labelStyle?: CSSProperties;
	labelShowBg?: boolean;
	labelBgStyle?: CSSProperties;
	labelBgPadding?: readonly [number, number];
	labelBgBorderRadius?: number;
	labelX: number;
	labelY: number;
}

export type SmartEdgeProps<
	EdgeType extends EdgeBase = EdgeBase,
	NodeType extends NodeBase = NodeBase,
> = EdgePosition & {
	id: EdgeType['id'];
	source: EdgeType['source'];
	target: EdgeType['target'];
	nodes: NodeType[];
	options: SmartEdgeOptions;
	style?: CSSProperties;
	className?: string;
	markerStart?: string;
	markerEnd?: string;
	interactionWidth?: number;
	label?: OctaneNode;
	labelStyle?: CSSProperties;
	labelShowBg?: boolean;
	labelBgStyle?: CSSProperties;
	labelBgPadding?: readonly [number, number];
	labelBgBorderRadius?: number;
};
