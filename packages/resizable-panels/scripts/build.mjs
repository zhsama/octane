import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { build } from 'esbuild';
import { createOctaneCompiler } from '../../octane/src/compiler/bundler.js';

const packageRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const distRoot = join(packageRoot, 'dist');

function filesUnder(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? filesUnder(path) : [path];
	});
}

function octaneSource(environment) {
	const compiler = createOctaneCompiler({ root: packageRoot });
	return {
		name: `resizable-panels-octane-${environment}`,
		setup(buildContext) {
			buildContext.onResolve({ filter: /^octane$/ }, () => ({
				path: environment === 'server' ? 'octane/server' : 'octane',
				external: true,
			}));
			buildContext.onLoad({ filter: /\.(?:ts|tsrx)$/ }, (args) => {
				const source = readFileSync(args.path, 'utf8');
				const result = compiler.transform(source, args.path, {
					dev: false,
					environment,
					hmr: false,
				});
				const transformed = result?.kind === 'compile' || result?.kind === 'slots';
				return {
					contents: transformed ? result.code : source,
					loader: result?.kind === 'compile' ? 'js' : 'ts',
					resolveDir: dirname(args.path),
				};
			});
		},
	};
}

async function buildRuntime(environment) {
	await build({
		banner: {
			js: '// octane-no-slot: this package already contains compiler-assigned hook slots.',
		},
		bundle: true,
		entryPoints: { index: join(sourceRoot, 'index.ts') },
		format: 'esm',
		outdir: join(distRoot, environment),
		packages: 'external',
		platform: environment === 'server' ? 'node' : 'browser',
		plugins: [octaneSource(environment)],
		target: 'esnext',
	});
}

function assertBuiltPackage() {
	const expected = ['dist/client/index.js', 'dist/server/index.js', 'dist/types/index.d.ts'];
	const missing = expected.filter((file) => !existsSync(join(packageRoot, file)));
	if (missing.length > 0) {
		throw new Error(
			`Resizable panels build omitted:\n${missing.map((file) => `  ${file}`).join('\n')}`,
		);
	}

	for (const file of filesUnder(distRoot)) {
		const packagePath = relative(packageRoot, file);
		if (/\.(?:ts|tsx|tsrx)$/.test(file) && !file.endsWith('.d.ts')) {
			throw new Error(`Resizable panels build leaked raw TypeScript source: ${packagePath}`);
		}
		if (!file.endsWith('.js')) continue;
		const source = readFileSync(file, 'utf8');
		if (!source.startsWith('// octane-no-slot:')) {
			throw new Error(`Resizable panels build omitted the precompiled marker: ${packagePath}`);
		}
		if (/(?:from\s*|import\s*\()['"][^'"]+\.tsrx['"]/.test(source)) {
			throw new Error(`Resizable panels build retained a TSRX import: ${packagePath}`);
		}
		if (packagePath.startsWith('dist/server/') && /from\s*['"]octane['"]/.test(source)) {
			throw new Error(
				`Resizable panels server build retained a client runtime import: ${packagePath}`,
			);
		}
	}
}

rmSync(distRoot, { force: true, recursive: true });
await Promise.all([buildRuntime('client'), buildRuntime('server')]);
execFileSync(
	process.execPath,
	[join(import.meta.dirname, 'generate-tsrx-types.mjs'), '--out-dir', 'dist/types'],
	{ cwd: packageRoot, stdio: 'inherit' },
);
assertBuiltPackage();

console.log('resizable-panels: built client, server, and declaration distributions.');
