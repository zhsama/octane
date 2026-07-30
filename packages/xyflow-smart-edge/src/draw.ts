import type {
	EndpointInfo,
	SmoothStepOptions,
	SVGDrawFunction,
	SVGSimpleBezierDrawFunction,
	XYPosition,
} from './types.js';

type HandleSide = 'top' | 'right' | 'bottom' | 'left';

const isHorizontalSide = (position: HandleSide): boolean =>
	position === 'left' || position === 'right';

const inferHandlePosition = (from: XYPosition, toward: XYPosition): HandleSide => {
	const deltaX = toward.x - from.x;
	const deltaY = toward.y - from.y;
	if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX >= 0 ? 'right' : 'left';
	return deltaY >= 0 ? 'bottom' : 'top';
};

const simpleBezierControl = (
	position: HandleSide,
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
): [number, number] =>
	isHorizontalSide(position) ? [0.5 * (fromX + toX), fromY] : [fromX, 0.5 * (fromY + toY)];

interface SimpleBezierPoint extends XYPosition {
	position: HandleSide;
}

export const svgDrawSimpleBezierLinePath: SVGSimpleBezierDrawFunction = (source, target, path) => {
	const allPoints: XYPosition[] = [source, ...path.map(([x, y]) => ({ x, y })), target];
	const points: SimpleBezierPoint[] = allPoints.map((point, index) => {
		if (index === 0) return { ...source, position: source.position as HandleSide };
		if (index === allPoints.length - 1) {
			return { ...target, position: target.position as HandleSide };
		}
		return {
			...point,
			position: inferHandlePosition(allPoints[index - 1], allPoints[index + 1]),
		};
	});

	let result = `M${String(points[0].x)},${String(points[0].y)}`;
	for (let index = 0; index < points.length - 1; index++) {
		const from = points[index];
		const to = points[index + 1];
		const [sourceControlX, sourceControlY] = simpleBezierControl(
			from.position,
			from.x,
			from.y,
			to.x,
			to.y,
		);
		const [targetControlX, targetControlY] = simpleBezierControl(
			to.position,
			to.x,
			to.y,
			from.x,
			from.y,
		);
		result += ` C${String(sourceControlX)},${String(sourceControlY)} ${String(targetControlX)},${String(targetControlY)} ${String(to.x)},${String(to.y)}`;
	}
	return result;
};

export const svgDrawStraightLinePath: SVGDrawFunction = (source, target, path) => {
	let result = `M ${String(source.x)}, ${String(source.y)} `;
	for (const [x, y] of path) result += `L ${String(x)}, ${String(y)} `;
	return `${result}L ${String(target.x)}, ${String(target.y)} `;
};

const midpoint = (firstX: number, firstY: number, secondX: number, secondY: number) => [
	(firstX - secondX) / 2 + secondX,
	(firstY - secondY) / 2 + secondY,
];

const quadraticBezierCurve = (points: number[][]): string => {
	let current = points[0];
	let result = `M${String(current[0])},${String(current[1])}M`;
	for (const next of points) {
		const middle = midpoint(current[0], current[1], next[0], next[1]);
		result += ` ${String(middle[0])},${String(middle[1])}`;
		result += `Q${String(next[0])},${String(next[1])}`;
		current = next;
	}
	const last = points[points.length - 1];
	return `${result} ${String(last[0])},${String(last[1])}`;
};

export const svgDrawSmoothLinePath: SVGDrawFunction = (source, target, path) =>
	quadraticBezierCurve([[source.x, source.y], ...path, [target.x, target.y]]);

const dedupePoints = (points: XYPosition[]): XYPosition[] =>
	points.filter(
		(point, index) =>
			index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y,
	);

const distance = (first: XYPosition, second: XYPosition): number =>
	Math.hypot(second.x - first.x, second.y - first.y);

const bend = (first: XYPosition, corner: XYPosition, last: XYPosition, size: number): string => {
	const bendSize = Math.min(distance(first, corner) / 2, distance(corner, last) / 2, size);
	if (
		(first.x === corner.x && corner.x === last.x) ||
		(first.y === corner.y && corner.y === last.y)
	) {
		return `L ${String(corner.x)},${String(corner.y)} `;
	}
	if (first.y === corner.y) {
		const xDirection = first.x < last.x ? -1 : 1;
		const yDirection = first.y < last.y ? 1 : -1;
		return `L ${String(corner.x + bendSize * xDirection)},${String(corner.y)}Q ${String(corner.x)},${String(corner.y)} ${String(corner.x)},${String(corner.y + bendSize * yDirection)} `;
	}
	const xDirection = first.x < last.x ? 1 : -1;
	const yDirection = first.y < last.y ? -1 : 1;
	return `L ${String(corner.x)},${String(corner.y + bendSize * yDirection)}Q ${String(corner.x)},${String(corner.y)} ${String(corner.x + bendSize * xDirection)},${String(corner.y)} `;
};

export const svgDrawSmoothStepLinePath = (options: SmoothStepOptions = {}): SVGDrawFunction => {
	const borderRadius = options.borderRadius ?? 5;
	return (source, target, path) => {
		const points = dedupePoints([source, ...path.map(([x, y]) => ({ x, y })), target]);
		return points.reduce((result, point, index) => {
			if (index > 0 && index < points.length - 1) {
				return result + bend(points[index - 1], point, points[index + 1], borderRadius);
			}
			return result + `${index === 0 ? 'M' : 'L'} ${String(point.x)},${String(point.y)} `;
		}, '');
	};
};

export const alignEndpoints = (
	source: EndpointInfo,
	target: EndpointInfo,
	graphPath: number[][],
): number[][] => {
	if (graphPath.length === 0) return graphPath;
	const axisFor = (position: HandleSide): 0 | 1 =>
		position === 'top' || position === 'bottom' ? 0 : 1;
	const result = graphPath.map(([x, y]) => [x, y]);

	const sourceAxis = axisFor(source.position as HandleSide);
	const sourceCoordinate = sourceAxis === 0 ? source.x : source.y;
	const sourceLeadingValue = result[0][sourceAxis];
	let leadingEnd = 0;
	while (leadingEnd < result.length && result[leadingEnd][sourceAxis] === sourceLeadingValue) {
		leadingEnd++;
	}
	for (let index = 0; index < leadingEnd; index++) {
		result[index][sourceAxis] = sourceCoordinate;
	}

	const targetAxis = axisFor(target.position as HandleSide);
	const targetCoordinate = targetAxis === 0 ? target.x : target.y;
	const targetTrailingValue = graphPath[graphPath.length - 1][targetAxis];
	let trailingStart = result.length;
	while (
		trailingStart > leadingEnd &&
		graphPath[trailingStart - 1][targetAxis] === targetTrailingValue
	) {
		trailingStart--;
	}
	for (let index = trailingStart; index < result.length; index++) {
		result[index][targetAxis] = targetCoordinate;
	}

	return result;
};
