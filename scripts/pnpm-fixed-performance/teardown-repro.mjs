import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
const root = mkdtempSync(resolve(tmpdir(), 'pnpm-teardown-'));
writeFileSync(
	resolve(root, 'server.cjs'),
	"process.stdout.write('READY '+process.pid+'\\n'); setInterval(() => {}, 1000);\n",
);
const bins = { 11: process.env.PNPM_REPRO_BINARY_11, 12: process.env.PNPM_REPRO_BINARY_12 };
const rows = [];
for (const [arm, bin] of Object.entries(bins)) {
	const cwd = resolve(root, arm);
	mkdirSync(cwd, { recursive: true });
	writeFileSync(
		resolve(cwd, 'package.json'),
		JSON.stringify({ name: 'teardown-probe', private: true }),
	);
	const env = {
		...process.env,
		PATH: dirname(bin) + ':' + process.env.PATH,
		npm_config_manage_package_manager_versions: 'false',
		pnpm_config_manage_package_manager_versions: 'false',
		pnpm_config_pm_on_fail: 'ignore',
	};
	const child = spawn('/bin/sh', ['-c', `"${bin}" exec node "${root}/server.cjs"`], {
		cwd,
		env,
		detached: true,
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	let stdout = '',
		stderr = '',
		closed = false,
		exited = false,
		serverPid;
	child.stdout.on('data', (b) => (stdout += b));
	child.stderr.on('data', (b) => (stderr += b));
	child.on('exit', () => (exited = true));
	child.on('close', () => (closed = true));
	await new Promise((ok, bad) => {
		const t = setTimeout(() => bad(new Error('No ready: ' + stdout + stderr)), 10000);
		child.stdout.on('data', () => {
			const m = stdout.match(/READY (\d+)/);
			if (m) {
				serverPid = +m[1];
				clearTimeout(t);
				ok();
			}
		});
	});
	const processes = execFileSync(
		'ps',
		['-o', 'pid,ppid,pgid,command', '-p', `${child.pid},${serverPid}`],
		{ encoding: 'utf8' },
	);
	process.kill(-child.pid, 'SIGKILL');
	await Promise.race([
		new Promise((r) => child.once('close', r)),
		new Promise((r) => setTimeout(r, 2000)),
	]);
	let serverAlive;
	try {
		process.kill(serverPid, 0);
		serverAlive = true;
	} catch {
		serverAlive = false;
	}
	const row = {
		arm,
		binary: bin,
		version: execFileSync(bin, ['--version'], { cwd, env, encoding: 'utf8' }).trim(),
		processes,
		parentExited: exited,
		stdioClosed: closed,
		serverAliveAfterProcessGroupKill: serverAlive,
		stdout,
		stderr,
	};
	if (serverAlive) process.kill(serverPid, 'SIGKILL');
	await new Promise((r) => (closed ? r() : child.once('close', r)));
	rows.push(row);
	console.log(JSON.stringify(row));
}
writeFileSync(
	process.env.PNPM_REPRO_RESULTS || resolve(root, 'results.json'),
	JSON.stringify(rows, null, 2) + '\n',
);
if (rows.some((row) => !row.stdioClosed || row.serverAliveAfterProcessGroupKill))
	process.exitCode = 1;
