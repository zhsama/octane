import { getBezierPath } from '@xyflow/system';
import { useLayoutEffect, useRef, useState } from 'octane';
import { excludeEdgeAncestorNodes, getAbsoluteNodes } from './bounds.js';
import { getSmartEdge } from './routing.js';
import type {
	EdgeBase,
	NodeBase,
	SmartEdgeFallbackProps,
	SmartEdgeLabelProps,
	SmartEdgeProps,
} from './types.js';

type LabelBounds = { x: number; y: number; width: number; height: number };

function EdgeLabel(props: SmartEdgeLabelProps) {
	const {
		x,
		y,
		label,
		labelStyle,
		labelShowBg = true,
		labelBgStyle,
		labelBgPadding = [2, 4],
		labelBgBorderRadius = 2,
	} = props;
	const textRef = useRef<SVGTextElement | null>(null);
	const [bounds, setBounds] = useState<LabelBounds>({
		x: 1,
		y: 0,
		width: 0,
		height: 0,
	});

	useLayoutEffect(() => {
		const text = textRef.current;
		if (!text || typeof text.getBBox !== 'function') return;
		const next = text.getBBox();
		setBounds({ x: next.x, y: next.y, width: next.width, height: next.height });
	}, [label]);

	const paddingX = labelBgPadding[0];
	const paddingY = labelBgPadding[1];

	return <g
		className="react-flow__edge-textwrapper"
		transform={`translate(${String(x - bounds.width / 2)} ${String(y - bounds.height / 2)})`}
		visibility={bounds.width ? 'visible' : 'hidden'}
	>
		@if (labelShowBg) {
			<rect
				className="react-flow__edge-textbg"
				height={bounds.height + 2 * paddingY}
				rx={labelBgBorderRadius}
				ry={labelBgBorderRadius}
				style={labelBgStyle}
				width={bounds.width + 2 * paddingX}
				x={-paddingX}
				y={-paddingY}
			/>
		}
		<text
			className="react-flow__edge-text"
			dy="0.3em"
			ref={textRef}
			style={labelStyle}
			y={bounds.height / 2}
		>{label}</text>
	</g>;
}

function BaseSmartEdge(props: SmartEdgeFallbackProps) {
	const {
		id,
		path,
		style,
		className,
		markerStart,
		markerEnd,
		interactionWidth = 20,
		label,
		labelStyle,
		labelShowBg,
		labelBgStyle,
		labelBgPadding,
		labelBgBorderRadius,
		labelX,
		labelY,
	} = props;
	const pathClassName = className ? `react-flow__edge-path ${className}` : 'react-flow__edge-path';

	return <>
		<path
			className={pathClassName}
			d={path}
			fill="none"
			id={id}
			markerEnd={markerEnd}
			markerStart={markerStart}
			style={style}
		/>
		@if (interactionWidth !== 0) {
			<path
				className="react-flow__edge-interaction"
				d={path}
				fill="none"
				strokeOpacity={0}
				strokeWidth={interactionWidth}
			/>
		}
		@if (label) {
			<EdgeLabel
				label={label}
				labelBgBorderRadius={labelBgBorderRadius}
				labelBgPadding={labelBgPadding}
				labelBgStyle={labelBgStyle}
				labelShowBg={labelShowBg}
				labelStyle={labelStyle}
				x={labelX}
				y={labelY}
			/>
		}
	</>;
}

export function SmartEdge<
	EdgeType extends EdgeBase = EdgeBase,
	NodeType extends NodeBase = NodeBase,
>(props: Readonly<SmartEdgeProps<EdgeType, NodeType>>) {
	const {
		nodes,
		options,
		id,
		source,
		target,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		style,
		className,
		markerStart,
		markerEnd,
		interactionWidth,
		label,
		labelStyle,
		labelShowBg,
		labelBgStyle,
		labelBgPadding,
		labelBgBorderRadius,
	} = props;
	const absoluteNodes = getAbsoluteNodes(nodes);
	const preparedNodes = excludeEdgeAncestorNodes(absoluteNodes, source, target);
	const response = getSmartEdge({
		nodes: preparedNodes,
		options,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
	});

	if (response instanceof Error) {
		const [fallbackPath, fallbackX, fallbackY] = getBezierPath({
			sourceX,
			sourceY,
			targetX,
			targetY,
			sourcePosition,
			targetPosition,
		});
		const fallbackProps: SmartEdgeFallbackProps = {
			id,
			source,
			target,
			path: fallbackPath,
			sourceX,
			sourceY,
			targetX,
			targetY,
			sourcePosition,
			targetPosition,
			style,
			className,
			markerStart,
			markerEnd,
			interactionWidth,
			label,
			labelStyle,
			labelShowBg,
			labelBgStyle,
			labelBgPadding,
			labelBgBorderRadius,
			labelX: fallbackX,
			labelY: fallbackY,
		};
		if (options.fallback) {
			const Fallback = options.fallback;
			return <Fallback {...fallbackProps} />;
		}
		return <BaseSmartEdge {...fallbackProps} />;
	}

	return <BaseSmartEdge
		id={id}
		source={source}
		target={target}
		path={response.svgPathString}
		sourceX={sourceX}
		sourceY={sourceY}
		targetX={targetX}
		targetY={targetY}
		sourcePosition={sourcePosition}
		targetPosition={targetPosition}
		style={style}
		className={className}
		markerStart={markerStart}
		markerEnd={markerEnd}
		interactionWidth={interactionWidth}
		label={label}
		labelStyle={labelStyle}
		labelShowBg={labelShowBg}
		labelBgStyle={labelBgStyle}
		labelBgPadding={labelBgPadding}
		labelBgBorderRadius={labelBgBorderRadius}
		labelX={response.edgeCenterX}
		labelY={response.edgeCenterY}
	/>;
}
