import { renderToString } from 'octane/server';
import { describe, expect, it } from 'vitest';

import { ServerFixture } from './fixture.tsrx';

describe('@octanejs/resizable-panels SSR', () => {
	it('renders stable group, panel, separator, and orientation markup without DOM globals', () => {
		expect(typeof document).toBe('undefined');
		const { html, css } = renderToString(ServerFixture);

		expect(html).toContain('id="server-group"');
		expect(html).toContain('data-group');
		expect(html).toContain('id="top"');
		expect(html).toContain('data-panel');
		expect(html).toContain('id="server-separator"');
		expect(html).toContain('role="separator"');
		expect(html).toContain('aria-orientation="horizontal"');
		expect(html).toContain('server top');
		expect(html).toContain('server bottom');
		expect(css).toBe('');
	});
});
