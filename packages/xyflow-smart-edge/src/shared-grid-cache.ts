import type { NodeBase, Rect, XYPosition } from '@xyflow/system';
import { getBoundingBoxes, getNodeRect } from './bounds.js';
import { buildObstacleMatrix } from './grid.js';
import type { GraphBoundingBox, NodeBoundingBox } from './types.js';

export interface SharedGrid {
	graphBox: GraphBoundingBox;
	obstacleBoxes: NodeBoundingBox[];
	obstacleMatrix: number[][];
	rawXMin: number;
	rawXMax: number;
	rawYMin: number;
	rawYMax: number;
}

const MAX_ENTRIES = 8;
const cache = new Map<string, SharedGrid>();
let buildCount = 0;

const numberKey = (value: number): number | string =>
	Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value) : `number:${String(value)}`;

const signatureOf = (
	nodes: NodeBase[],
	nodePadding: number,
	gridRatio: number,
	avoidAreas: Rect[],
): string =>
	JSON.stringify([
		nodes.map((node) => {
			const rect = getNodeRect(node);
			return [
				node.id,
				numberKey(rect.x),
				numberKey(rect.y),
				numberKey(rect.width),
				numberKey(rect.height),
			];
		}),
		numberKey(nodePadding),
		numberKey(gridRatio),
		avoidAreas.map((area) => [
			numberKey(area.x),
			numberKey(area.y),
			numberKey(area.width),
			numberKey(area.height),
		]),
	]);

const rawBounds = (boxes: NodeBoundingBox[]) => ({
	rawXMin: Math.min(...boxes.map((box) => box.topLeft.x)),
	rawYMin: Math.min(...boxes.map((box) => box.topLeft.y)),
	rawXMax: Math.max(...boxes.map((box) => box.bottomRight.x)),
	rawYMax: Math.max(...boxes.map((box) => box.bottomRight.y)),
});

export const getSharedGrid = (
	nodes: NodeBase[],
	nodePadding: number,
	gridRatio: number,
	avoidAreas: Rect[],
): SharedGrid | null => {
	if (nodes.length === 0 && avoidAreas.length === 0) return null;
	const signature = signatureOf(nodes, nodePadding, gridRatio, avoidAreas);
	const cached = cache.get(signature);
	if (cached) return cached;

	buildCount++;
	const { graphBox, nodeBoxes, avoidBoxes } = getBoundingBoxes(
		nodes,
		nodePadding,
		gridRatio,
		avoidAreas,
	);
	const obstacleBoxes = [...nodeBoxes, ...avoidBoxes];
	const built = {
		graphBox,
		obstacleBoxes,
		obstacleMatrix: buildObstacleMatrix(graphBox, obstacleBoxes, gridRatio),
		...rawBounds(obstacleBoxes),
	};
	if (cache.size >= MAX_ENTRIES) cache.clear();
	cache.set(signature, built);
	return built;
};

export const isWithinSharedBounds = (shared: SharedGrid, points: XYPosition[]): boolean => {
	const xValues = points.map((point) => point.x);
	const yValues = points.map((point) => point.y);
	return (
		Math.min(...xValues) >= shared.rawXMin &&
		Math.max(...xValues) <= shared.rawXMax &&
		Math.min(...yValues) >= shared.rawYMin &&
		Math.max(...yValues) <= shared.rawYMax
	);
};

export const resetSharedGridCacheForTests = (): void => {
	cache.clear();
	buildCount = 0;
};

export const sharedGridCacheStatsForTests = () => ({
	buildCount,
	size: cache.size,
	maxEntries: MAX_ENTRIES,
});
