import { createServer as createNetServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';

import { octane } from '../../../octane/src/compiler/vite.js';

const browserTestRoot = dirname(fileURLToPath(import.meta.url));
const harnessRoot = resolve(browserTestRoot, 'harness');
const bindingSource = resolve(browserTestRoot, '../../src/index.ts');
const octaneSource = resolve(browserTestRoot, '../../../octane/src/index.ts');

function getFreePort(): Promise<number> {
	return new Promise((resolvePort, reject) => {
		const server = createNetServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address() as import('node:net').AddressInfo;
			server.close(() => resolvePort(port));
		});
	});
}

let viteServer: ViteDevServer;
let browser: import('playwright').Browser;
let page: import('playwright').Page;
let origin = '';
let pageErrors: string[] = [];

beforeAll(async () => {
	try {
		const { chromium } = await import('playwright');
		browser = await chromium.launch({ headless: true });
	} catch (error) {
		throw new Error(
			'[@octanejs/resizable-panels browser] Chromium is required ' +
				'(run `pnpm exec playwright install chromium`): ' +
				(error instanceof Error ? error.message.split('\n')[0] : String(error)),
		);
	}

	const port = await getFreePort();
	viteServer = await createServer({
		root: harnessRoot,
		logLevel: 'error',
		server: {
			host: '127.0.0.1',
			port,
			strictPort: true,
		},
		plugins: [octane()],
		resolve: {
			alias: [
				{
					find: /^@octanejs\/resizable-panels$/,
					replacement: bindingSource,
				},
				{ find: /^octane$/, replacement: octaneSource },
			],
		},
	});
	await viteServer.listen();
	origin = `http://127.0.0.1:${port}`;
}, 60_000);

afterAll(async () => {
	await page?.close().catch(() => {});
	await browser?.close().catch(() => {});
	await viteServer?.close().catch(() => {});
});

beforeEach(async () => {
	pageErrors = [];
	page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
	page.on('pageerror', (error) => pageErrors.push(String(error)));
	await page.goto(origin, { waitUntil: 'networkidle' });
	await page.locator('#horizontal-separator').waitFor();
	await expect.poll(() => page.locator('#horizontal-result').textContent()).not.toBe('');
});

afterEach(async () => {
	try {
		expect(pageErrors, 'browser page errors').toEqual([]);
	} finally {
		await page.close();
	}
});

async function readResult(selector: string) {
	const text = await page.locator(selector).textContent();
	if (!text) {
		throw new Error(`Missing result at ${selector}`);
	}
	return JSON.parse(text) as {
		layout: Record<string, number>;
		meta: { isUserInteraction: boolean };
	};
}

async function dragAt(
	separatorSelector: string,
	axis: 'horizontal' | 'vertical',
	delta: number,
	startOffset = 0,
) {
	const bounds = await page.locator(separatorSelector).boundingBox();
	if (!bounds) {
		throw new Error(`${separatorSelector} has no browser bounds`);
	}
	const x = bounds.x + bounds.width / 2 + (axis === 'horizontal' ? startOffset : 0);
	const y = bounds.y + bounds.height / 2 + (axis === 'vertical' ? startOffset : 0);
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(
		x + (axis === 'horizontal' ? delta : 0),
		y + (axis === 'vertical' ? delta : 0),
		{ steps: 6 },
	);
	await page.mouse.up();
}

describe('@octanejs/resizable-panels real-browser behavior', () => {
	it('matches react-resizable-panels for a real pointer resize', async () => {
		await dragAt('#horizontal-separator', 'horizontal', 60);
		const octane = await readResult('#horizontal-result');
		const octaneAria = await page.locator('#horizontal-separator').getAttribute('aria-valuenow');

		await page.goto(`${origin}/react.html`, { waitUntil: 'networkidle' });
		await page.locator('#horizontal-separator').waitFor();
		await expect.poll(() => page.locator('#horizontal-result').textContent()).not.toBe('');
		await dragAt('#horizontal-separator', 'horizontal', 60);
		const react = await readResult('#horizontal-result');
		const reactAria = await page.locator('#horizontal-separator').getAttribute('aria-valuenow');

		expect(octane.layout.left).toBeCloseTo(react.layout.left, 5);
		expect(octane.layout.right).toBeCloseTo(react.layout.right, 5);
		expect(octane.meta).toEqual(react.meta);
		expect(octaneAria).toBe(reactAria);
	});

	it('drags horizontal and vertical groups independently with user metadata', async () => {
		await dragAt('#horizontal-separator', 'horizontal', 60);
		await expect
			.poll(async () => (await readResult('#horizontal-result')).layout.left)
			.toBeGreaterThan(55);
		expect((await readResult('#horizontal-result')).meta).toEqual({
			isUserInteraction: true,
		});
		expect((await readResult('#vertical-result')).layout.top).toBe(50);

		await dragAt('#vertical-separator', 'vertical', 40);
		await expect
			.poll(async () => (await readResult('#vertical-result')).layout.top)
			.toBeGreaterThan(55);
		expect((await readResult('#vertical-result')).meta).toEqual({
			isUserInteraction: true,
		});
	});

	it('supports keyboard resize, collapse, ARIA, and imperative APIs', async () => {
		const separator = page.locator('#horizontal-separator');
		await separator.focus();
		await page.keyboard.press('ArrowRight');
		await expect.poll(async () => (await readResult('#horizontal-result')).layout.left).toBe(55);
		expect((await readResult('#horizontal-result')).meta.isUserInteraction).toBe(true);
		expect(await separator.getAttribute('role')).toBe('separator');
		expect(await separator.getAttribute('aria-orientation')).toBe('vertical');
		expect(await separator.getAttribute('aria-controls')).toBe('left');
		expect(await separator.getAttribute('aria-valuenow')).toBe('55');

		await page.locator('#set-horizontal-layout').click();
		await expect.poll(async () => (await readResult('#horizontal-result')).layout.left).toBe(30);
		expect((await readResult('#horizontal-result')).meta.isUserInteraction).toBe(false);

		await page.locator('#collapse-left').click();
		await expect.poll(async () => (await readResult('#horizontal-result')).layout.left).toBe(0);
		await page.locator('#expand-left').click();
		await expect.poll(async () => (await readResult('#horizontal-result')).layout.left).toBe(30);
		await page.locator('#resize-left').click();
		await expect.poll(async () => (await readResult('#horizontal-result')).layout.left).toBe(40);
	});

	it('applies resizeTargetMinimumSize prop updates to the live hit region', async () => {
		const before = await readResult('#horizontal-result');
		await dragAt('#horizontal-separator', 'horizontal', 30, 18);
		expect((await readResult('#horizontal-result')).layout).toEqual(before.layout);

		await page.locator('#widen-resize-target').click();
		await dragAt('#horizontal-separator', 'horizontal', 30, 18);
		await expect
			.poll(async () => (await readResult('#horizontal-result')).layout.left)
			.toBeGreaterThan(before.layout.left);
	});

	it('switches onResize callback identity without stale notifications', async () => {
		await expect.poll(() => page.locator('#resize-result').textContent()).toMatch(/^first:/);
		await page.locator('#switch-resize-handler').click();
		await page.locator('#resize-left').click();
		await expect.poll(() => page.locator('#resize-result').textContent()).toMatch(/^second:40/);
	});
});
