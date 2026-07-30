import { flushSync, hydrateRoot } from 'octane';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SERVER_PROPS, ServerScene } from './_fixtures/edge-scene.tsrx';

// Pinned output from the xyflow-smart-edge-ssr project rendering this same
// fixture. The server test independently verifies its semantic SVG payload.
const SERVER_HTML =
	'<svg id="edge-scene" viewBox="0 0 400 200"><g><!--[--><!--[--><!--[--><path class="react-flow__edge-path" d="M80,80M 80,80Q80,80 85,80Q90,80 95,85Q100,90 100,95Q100,100 100,105Q100,110 100,115Q100,120 100,125Q100,130 100,135Q100,140 105,145Q110,150 115,150Q120,150 125,150Q130,150 135,150Q140,150 145,150Q150,150 155,150Q160,150 165,150Q170,150 175,150Q180,150 185,150Q190,150 195,150Q200,150 205,150Q210,150 215,150Q220,150 225,145Q230,140 230,135Q230,130 230,125Q230,120 235,115Q240,110 245,105Q250,100 250,95Q250,90 255,85Q260,80 265,80Q270,80 275,80Q280,80 280,80" fill="none" id="server-edge" marker-end="url(#arrow)" style="stroke:purple;stroke-width:3;"></path><!--[--><!--[--><path class="react-flow__edge-interaction" d="M80,80M 80,80Q80,80 85,80Q90,80 95,85Q100,90 100,95Q100,100 100,105Q100,110 100,115Q100,120 100,125Q100,130 100,135Q100,140 105,145Q110,150 115,150Q120,150 125,150Q130,150 135,150Q140,150 145,150Q150,150 155,150Q160,150 165,150Q170,150 175,150Q180,150 185,150Q190,150 195,150Q200,150 205,150Q210,150 215,150Q220,150 225,145Q230,140 230,135Q230,130 230,125Q230,120 235,115Q240,110 245,105Q250,100 250,95Q250,90 255,85Q260,80 265,80Q270,80 275,80Q280,80 280,80" fill="none" stroke-opacity="0" stroke-width="24"></path><!--]--><!--]--><!--[--><!--[--><!--[--><g class="react-flow__edge-textwrapper" transform="translate(170 150)" visibility="hidden"><!--[--><!--[--><rect class="react-flow__edge-textbg" height="8" rx="2" ry="2" width="4" x="-2" y="-4"></rect><!--]--><!--]--><text class="react-flow__edge-text" dy="0.3em" y="0">route</text></g><!--]--><!--]--><!--]--><!--]--><!--]--><!--]--></g></svg>';

let container: HTMLElement;
let error: ReturnType<typeof vi.spyOn>;
let getBBoxDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
	getBBoxDescriptor = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getBBox');
	Object.defineProperty(SVGElement.prototype, 'getBBox', {
		configurable: true,
		value: () => ({ x: 4, y: 2, width: 42, height: 12 }),
	});
	container = document.createElement('div');
	container.innerHTML = SERVER_HTML;
	document.body.appendChild(container);
	error = vi.spyOn(console, 'error');
});

afterEach(() => {
	expect(error.mock.calls).toEqual([]);
	error.mockRestore();
	if (getBBoxDescriptor) {
		Object.defineProperty(SVGElement.prototype, 'getBBox', getBBoxDescriptor);
	} else {
		delete (SVGElement.prototype as { getBBox?: unknown }).getBBox;
	}
	container.remove();
});

describe('@octanejs/xyflow-smart-edge hydration', () => {
	it('adopts SVG hosts, measures the label, and updates the route in place', () => {
		const path = container.querySelector('.react-flow__edge-path') as SVGPathElement;
		const interaction = container.querySelector('.react-flow__edge-interaction') as SVGPathElement;
		const labelWrapper = container.querySelector('.react-flow__edge-textwrapper') as SVGGElement;
		const label = container.querySelector('.react-flow__edge-text') as SVGTextElement;
		const initialRoute = path.getAttribute('d');
		expect(labelWrapper.getAttribute('visibility')).toBe('hidden');

		const root = hydrateRoot(container, ServerScene, SERVER_PROPS);
		flushSync(() => {});

		expect(container.querySelector('.react-flow__edge-path')).toBe(path);
		expect(container.querySelector('.react-flow__edge-interaction')).toBe(interaction);
		expect(container.querySelector('.react-flow__edge-textwrapper')).toBe(labelWrapper);
		expect(container.querySelector('.react-flow__edge-text')).toBe(label);
		expect(labelWrapper.getAttribute('visibility')).toBe('visible');
		expect(labelWrapper.getAttribute('transform')).toBe('translate(149 144)');
		expect(label.getAttribute('y')).toBe('6');
		const background = container.querySelector('.react-flow__edge-textbg') as SVGRectElement;
		expect(background.getAttribute('width')).toBe('46');
		expect(background.getAttribute('height')).toBe('20');

		const movedNodes = SERVER_PROPS.nodes.map((node) =>
			node.id === 'obstacle' ? { ...node, position: { x: 170, y: 150 } } : node,
		);
		flushSync(() =>
			root.render(ServerScene, {
				...SERVER_PROPS,
				nodes: movedNodes,
				style: { ...SERVER_PROPS.style, stroke: 'green' },
			}),
		);

		expect(container.querySelector('.react-flow__edge-path')).toBe(path);
		expect(path.getAttribute('d')).not.toBe(initialRoute);
		expect(path.style.stroke).toBe('green');
		expect(interaction.getAttribute('d')).toBe(path.getAttribute('d'));
		root.unmount();
	});
});
