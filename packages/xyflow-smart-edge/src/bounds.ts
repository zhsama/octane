import { getNodeDimensions, getNodePositionWithOrigin, Position } from '@xyflow/system';
import type { NodeBase, Rect, XYPosition } from '@xyflow/system';
import type { FloatingEdgeParams, GraphBoundingBox, NodeBoundingBox } from './types.js';

export const round = (value: number, multiple = 10): number =>
	Math.round(value / multiple) * multiple;
export const roundDown = (value: number, multiple = 10): number =>
	Math.floor(value / multiple) * multiple;
export const roundUp = (value: number, multiple = 10): number =>
	Math.ceil(value / multiple) * multiple;
export const toInteger = (value: number, minimum = 0): number => {
	const result = Math.max(Math.round(value), minimum);
	return Number.isInteger(result) && result >= minimum ? result : minimum;
};

const buildBox = (
	originX: number,
	originY: number,
	width: number,
	height: number,
	padding: number,
	roundTo: number,
) => {
	const topLeft = { x: originX - padding, y: originY - padding };
	const bottomLeft = { x: originX - padding, y: originY + height + padding };
	const topRight = { x: originX + width + padding, y: originY - padding };
	const bottomRight = {
		x: originX + width + padding,
		y: originY + height + padding,
	};

	if (roundTo > 0) {
		topLeft.x = roundDown(topLeft.x, roundTo);
		topLeft.y = roundDown(topLeft.y, roundTo);
		bottomLeft.x = roundDown(bottomLeft.x, roundTo);
		bottomLeft.y = roundUp(bottomLeft.y, roundTo);
		topRight.x = roundUp(topRight.x, roundTo);
		topRight.y = roundDown(topRight.y, roundTo);
		bottomRight.x = roundUp(bottomRight.x, roundTo);
		bottomRight.y = roundUp(bottomRight.y, roundTo);
	}

	return { topLeft, bottomLeft, topRight, bottomRight };
};

export const getNodeRect = (node: NodeBase): Rect => {
	const dimensions = getNodeDimensions(node);
	const topLeft = getNodePositionWithOrigin(node);
	return {
		x: topLeft.x,
		y: topLeft.y,
		width: Math.max(dimensions.width, 1),
		height: Math.max(dimensions.height, 1),
	};
};

export const getBoundingBoxes = <NodeType extends NodeBase>(
	nodes: NodeType[],
	nodePadding = 2,
	roundTo = 2,
	avoidAreas: Rect[] = [],
	extraPoints: XYPosition[] = [],
) => {
	let xMax = Number.MIN_SAFE_INTEGER;
	let yMax = Number.MIN_SAFE_INTEGER;
	let xMin = Number.MAX_SAFE_INTEGER;
	let yMin = Number.MAX_SAFE_INTEGER;

	const expandBounds = (topLeft: XYPosition, bottomRight: XYPosition): void => {
		if (topLeft.y < yMin) yMin = topLeft.y;
		if (topLeft.x < xMin) xMin = topLeft.x;
		if (bottomRight.y > yMax) yMax = bottomRight.y;
		if (bottomRight.x > xMax) xMax = bottomRight.x;
	};

	const nodeBoxes: NodeBoundingBox[] = nodes.map((node) => {
		const { x, y, width, height } = getNodeRect(node);
		const corners = buildBox(x, y, width, height, nodePadding, roundTo);
		expandBounds(corners.topLeft, corners.bottomRight);
		return { id: node.id, width, height, ...corners };
	});

	const avoidBoxes: NodeBoundingBox[] = avoidAreas.map((area, index) => {
		const width = Math.max(area.width, 1);
		const height = Math.max(area.height, 1);
		const corners = buildBox(area.x, area.y, width, height, nodePadding, roundTo);
		expandBounds(corners.topLeft, corners.bottomRight);
		return { id: `avoid-${String(index)}`, width, height, ...corners };
	});

	for (const point of extraPoints) expandBounds(point, point);

	const graphPadding = nodePadding * 2;
	xMax = roundUp(xMax + graphPadding, roundTo);
	yMax = roundUp(yMax + graphPadding, roundTo);
	xMin = roundDown(xMin - graphPadding, roundTo);
	yMin = roundDown(yMin - graphPadding, roundTo);

	const topLeft = { x: xMin, y: yMin };
	const bottomLeft = { x: xMin, y: yMax };
	const topRight = { x: xMax, y: yMin };
	const bottomRight = { x: xMax, y: yMax };
	const graphBox: GraphBoundingBox = {
		topLeft,
		bottomLeft,
		topRight,
		bottomRight,
		width: Math.abs(xMin - xMax),
		height: Math.abs(yMin - yMax),
		xMax,
		yMax,
		xMin,
		yMin,
	};
	return { nodeBoxes, graphBox, avoidBoxes };
};

const nodeMap = <NodeType extends NodeBase>(nodes: NodeType[]): Map<string, NodeType> =>
	new Map(nodes.map((node) => [node.id, node]));

const absolutePosition = <NodeType extends NodeBase>(
	node: NodeType,
	nodes: Map<string, NodeType>,
): XYPosition => {
	let x = node.position.x;
	let y = node.position.y;
	let parentId = node.parentId;
	const visited = new Set([node.id]);
	while (parentId && !visited.has(parentId)) {
		visited.add(parentId);
		const parent = nodes.get(parentId);
		if (!parent) break;
		// A child's position is relative to its parent's top-left, not the
		// parent's anchor. Account for every ancestor's own dimensions/origin
		// exactly as XYFlow's calculateChildXYZ does.
		const parentRect = getNodeRect(parent);
		x += parentRect.x;
		y += parentRect.y;
		parentId = parent.parentId;
	}
	return { x, y };
};

export const getAbsoluteNodes = <NodeType extends NodeBase>(nodes: NodeType[]): NodeType[] => {
	const lookup = nodeMap(nodes);
	return nodes.map((node) =>
		node.parentId ? ({ ...node, position: absolutePosition(node, lookup) } as NodeType) : node,
	);
};

const ancestorIds = <NodeType extends NodeBase>(
	id: string,
	nodes: Map<string, NodeType>,
): Set<string> => {
	const result = new Set<string>();
	let parentId = nodes.get(id)?.parentId;
	while (parentId && !result.has(parentId)) {
		result.add(parentId);
		parentId = nodes.get(parentId)?.parentId;
	}
	return result;
};

export const excludeEdgeAncestorNodes = <NodeType extends NodeBase>(
	nodes: NodeType[],
	sourceId: string,
	targetId: string,
): NodeType[] => {
	const lookup = nodeMap(nodes);
	const ancestors = ancestorIds(sourceId, lookup);
	for (const id of ancestorIds(targetId, lookup)) ancestors.add(id);
	return ancestors.size === 0 ? nodes : nodes.filter((node) => !ancestors.has(node.id));
};

export const getNodeIntersection = (
	intersectionNode: NodeBase,
	otherNode: NodeBase,
): XYPosition => {
	const intersection = getNodeRect(intersectionNode);
	const other = getNodeRect(otherNode);
	const halfWidth = intersection.width / 2;
	const halfHeight = intersection.height / 2;
	const centerX = intersection.x + halfWidth;
	const centerY = intersection.y + halfHeight;
	const otherCenterX = other.x + other.width / 2;
	const otherCenterY = other.y + other.height / 2;
	const normalizedX =
		(otherCenterX - centerX) / (2 * halfWidth) - (otherCenterY - centerY) / (2 * halfHeight);
	const normalizedY =
		(otherCenterX - centerX) / (2 * halfWidth) + (otherCenterY - centerY) / (2 * halfHeight);
	const scale = 1 / (Math.abs(normalizedX) + Math.abs(normalizedY) || 1);
	const scaledX = scale * normalizedX;
	const scaledY = scale * normalizedY;
	return {
		x: halfWidth * (scaledX + scaledY) + centerX,
		y: halfHeight * (-scaledX + scaledY) + centerY,
	};
};

export const getEdgePosition = (node: NodeBase, intersectionPoint: XYPosition): Position => {
	const { x, y, width, height } = getNodeRect(node);
	const pointX = Math.round(intersectionPoint.x);
	const pointY = Math.round(intersectionPoint.y);
	if (pointX <= Math.round(x) + 1) return Position.Left;
	if (pointX >= Math.round(x) + width - 1) return Position.Right;
	if (pointY <= Math.round(y) + 1) return Position.Top;
	if (pointY >= Math.round(y) + height - 1) return Position.Bottom;
	return Position.Top;
};

export const getFloatingEdgeParams = (
	sourceNode: NodeBase,
	targetNode: NodeBase,
): FloatingEdgeParams => {
	const sourcePoint = getNodeIntersection(sourceNode, targetNode);
	const targetPoint = getNodeIntersection(targetNode, sourceNode);
	return {
		sx: sourcePoint.x,
		sy: sourcePoint.y,
		tx: targetPoint.x,
		ty: targetPoint.y,
		sourcePos: getEdgePosition(sourceNode, sourcePoint),
		targetPos: getEdgePosition(targetNode, targetPoint),
	};
};
