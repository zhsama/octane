import { renderToString } from 'octane/server';
import { describe, expect, it } from 'vitest';
import { SERVER_PROPS, ServerScene } from '../_fixtures/edge-scene.tsrx';

const stripMarkers = (html: string): string => html.replace(/<!--[^>]*-->/g, '');

describe('@octanejs/xyflow-smart-edge SSR', () => {
	it('renders deterministic SVG paths, interaction width, markers, and labels', () => {
		expect(typeof document).toBe('undefined');
		const { html, css } = renderToString(ServerScene, SERVER_PROPS);
		const flat = stripMarkers(html);
		expect(flat).toContain('<svg id="edge-scene" viewBox="0 0 400 200"><g>');
		expect(flat).toContain('class="react-flow__edge-path"');
		expect(flat).toContain('marker-end="url(#arrow)"');
		expect(flat).toContain('stroke-width="24"');
		expect(flat).toContain('class="react-flow__edge-text"');
		expect(flat).toContain('>route</text>');
		expect(flat.match(/class="react-flow__edge-path"/g)).toHaveLength(1);
		expect(css).toBe('');
	});
});
