import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../examples/draftboard/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const started = performance.now();
const child = spawn(process.argv[2], ['--dir', 'examples/draftboard', 'dev'], {
	cwd: root,
	env: process.env,
	detached: true,
	stdio: ['ignore', 'pipe', 'pipe'],
});
const exited = once(child, 'exit');
let output = '';
let timeout;
try {
	await new Promise((resolve, reject) => {
		timeout = setTimeout(() => reject(new Error(`Dev server timed out: ${output}`)), 60000);
		const consume = (data) => {
			output += data.toString();
			if (output.includes('http://localhost:5228/')) resolve();
		};
		child.stdout.on('data', consume);
		child.stderr.on('data', consume);
		child.once('error', reject);
		child.once('exit', (code) => reject(new Error(`Dev server exited ${code}: ${output}`)));
	});
	clearTimeout(timeout);
	await page.goto('http://localhost:5228/boards/launch');
	await page.getByTestId('board-ready').waitFor({ state: 'visible' });
	await page.getByRole('application', { name: 'Draftboard canvas' }).waitFor({ state: 'visible' });
	if (errors.length) throw new Error(errors.join('\n'));
	const readySeconds = (performance.now() - started) / 1000;
	console.log(output);
	console.log(
		JSON.stringify({ ready_seconds: readySeconds, canvas_visible: true, page_errors: errors }),
	);
} finally {
	clearTimeout(timeout);
	if (child.exitCode === null && child.signalCode === null) process.kill(-child.pid, 'SIGTERM');
	await exited;
	await browser.close();
}
