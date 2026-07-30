import {
	pathfindingJumpPointNoDiagonal,
	svgDrawSmoothStepLinePath,
} from '@octanejs/xyflow-smart-edge';
import { describe, expect, it } from 'vitest';
import { mount } from '../../octane/tests/_helpers.js';
import {
	CustomFallback,
	EdgeScene,
	SERVER_PROPS,
	SiblingScene,
	type SceneProps,
} from './_fixtures/edge-scene.tsrx';

describe('SmartEdge SVG component', () => {
	it('renders the visible, interaction, marker, style, and label hosts', () => {
		const props: SceneProps = {
			...SERVER_PROPS,
			className: 'consumer-edge',
			markerStart: 'url(#start)',
			labelBgBorderRadius: 7,
			labelBgPadding: [3, 5],
			labelBgStyle: { fill: 'white' },
			labelStyle: { fill: 'black' },
		};
		const mounted = mount(EdgeScene, props);
		const path = mounted.find('.react-flow__edge-path') as SVGPathElement;
		const interaction = mounted.find('.react-flow__edge-interaction') as SVGPathElement;

		expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg');
		expect(path.getAttribute('d')).toBeTruthy();
		expect(path.id).toBe('server-edge');
		expect(path.getAttribute('fill')).toBe('none');
		expect(path.getAttribute('class')).toBe('react-flow__edge-path consumer-edge');
		expect(path.getAttribute('marker-start')).toBe('url(#start)');
		expect(path.getAttribute('marker-end')).toBe('url(#arrow)');
		expect(path.style.stroke).toBe('purple');
		expect(path.style.strokeWidth).toBe('3');
		expect(interaction.getAttribute('d')).toBe(path.getAttribute('d'));
		expect(interaction.getAttribute('stroke-width')).toBe('24');
		expect(interaction.getAttribute('stroke-opacity')).toBe('0');
		expect(mounted.find('.react-flow__edge-text').textContent).toBe('route');
		expect(mounted.find('.react-flow__edge-textbg').getAttribute('rx')).toBe('7');
		mounted.unmount();
	});

	it('recomputes from changed nodes and draw options without stale identity state', () => {
		const firstOptions = {
			...SERVER_PROPS.options,
			drawEdge: svgDrawSmoothStepLinePath({ borderRadius: 2 }),
			generatePath: pathfindingJumpPointNoDiagonal,
		};
		const mounted = mount(EdgeScene, {
			...SERVER_PROPS,
			options: firstOptions,
		});
		const path = mounted.find('.react-flow__edge-path');
		const initial = path.getAttribute('d');
		expect(initial).toContain('Q');

		mounted.update(EdgeScene, {
			...SERVER_PROPS,
			options: {
				...firstOptions,
				drawEdge: svgDrawSmoothStepLinePath({ borderRadius: 18 }),
			},
		});
		const rounded = path.getAttribute('d');
		expect(mounted.find('.react-flow__edge-path')).toBe(path);
		expect(rounded).not.toBe(initial);
		expect(rounded).toContain('Q');

		const movedNodes = SERVER_PROPS.nodes.map((node) =>
			node.id === 'obstacle' ? { ...node, position: { x: 170, y: 150 } } : node,
		);
		mounted.update(EdgeScene, {
			...SERVER_PROPS,
			nodes: movedNodes,
			options: {
				...firstOptions,
				drawEdge: svgDrawSmoothStepLinePath({ borderRadius: 18 }),
			},
		});

		expect(mounted.find('.react-flow__edge-path')).toBe(path);
		expect(path.getAttribute('d')).not.toBe(rounded);
		mounted.unmount();
	});

	it('keeps sibling routes independent while one sibling changes', () => {
		const secondNodes = SERVER_PROPS.nodes.map((node) => ({
			...node,
			id: `${node.id}-second`,
			position: { x: node.position.x + 100, y: node.position.y + 120 },
		}));
		const second: SceneProps = {
			...SERVER_PROPS,
			id: 'second-edge',
			source: 'source-second',
			target: 'target-second',
			sourceX: 180,
			sourceY: 200,
			targetX: 380,
			targetY: 200,
			nodes: secondNodes,
			label: 'second',
		};
		const mounted = mount(SiblingScene, {
			first: SERVER_PROPS,
			second,
		});
		const firstPath = mounted.find('[data-edge="first"] .react-flow__edge-path');
		const secondPath = mounted.find('[data-edge="second"] .react-flow__edge-path');
		const secondRoute = secondPath.getAttribute('d');
		const firstRoute = firstPath.getAttribute('d');
		expect(secondRoute).not.toBe(firstRoute);

		mounted.update(SiblingScene, {
			first: {
				...SERVER_PROPS,
				nodes: SERVER_PROPS.nodes.map((node) =>
					node.id === 'obstacle' ? { ...node, position: { x: 170, y: 180 } } : node,
				),
			},
			second,
		});
		expect(mounted.find('[data-edge="first"] .react-flow__edge-path')).toBe(firstPath);
		expect(mounted.find('[data-edge="first"] .react-flow__edge-path').getAttribute('d')).not.toBe(
			firstRoute,
		);
		expect(mounted.find('[data-edge="second"] .react-flow__edge-path')).toBe(secondPath);
		expect(secondPath.getAttribute('d')).toBe(secondRoute);
		mounted.unmount();
	});

	it('uses the built-in Bezier or an explicit Octane fallback on failure', () => {
		const failedOptions = {
			...SERVER_PROPS.options,
			generatePath() {
				throw new Error('blocked');
			},
		};
		const builtIn = mount(EdgeScene, {
			...SERVER_PROPS,
			options: failedOptions,
		});
		expect(builtIn.find('.react-flow__edge-path').getAttribute('d')).toContain('C');
		builtIn.unmount();

		const custom = mount(EdgeScene, {
			...SERVER_PROPS,
			options: { ...failedOptions, fallback: CustomFallback },
		});
		expect(custom.find('.custom-fallback').getAttribute('data-edge-id')).toBe('server-edge');
		expect(custom.findAll('.react-flow__edge-path')).toHaveLength(0);
		custom.unmount();
	});
});
