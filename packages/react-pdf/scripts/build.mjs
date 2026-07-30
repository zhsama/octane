import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { build } from 'esbuild';
import { createOctaneCompiler } from '../../octane/src/compiler/bundler.js';

const packageRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const distRoot = join(packageRoot, 'dist');
const entryPoints = { index: join(sourceRoot, 'index.tsrx') };

function filesUnder(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? filesUnder(path) : [path];
	});
}

function octaneSource(environment) {
	const compiler = createOctaneCompiler({ root: packageRoot });
	return {
		name: `react-pdf-octane-${environment}`,
		setup(buildContext) {
			buildContext.onResolve({ filter: /^octane$/ }, () => ({
				path: environment === 'server' ? 'octane/server' : 'octane',
				external: true,
			}));
			if (environment === 'server') {
				buildContext.onResolve({ filter: /^pdfjs-dist$/ }, () => ({
					path: join(sourceRoot, 'pdfjs.server.ts'),
				}));
			}
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
					loader: transformed ? 'js' : 'ts',
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
		entryPoints,
		format: 'esm',
		outdir: join(distRoot, environment),
		packages: 'external',
		platform: environment === 'server' ? 'node' : 'browser',
		plugins: [octaneSource(environment)],
		splitting: true,
		target: 'esnext',
	});
}

function assertBuiltPackage() {
	const expected = [
		'dist/client/index.js',
		'dist/server/index.js',
		'dist/types/index.d.ts',
		'dist/Page/AnnotationLayer.css',
		'dist/Page/TextLayer.css',
	];
	const missing = expected.filter((file) => !existsSync(join(packageRoot, file)));
	if (missing.length) {
		throw new Error(`React-PDF build omitted:\n${missing.map((file) => `  ${file}`).join('\n')}`);
	}
	for (const file of filesUnder(distRoot)) {
		const packagePath = relative(packageRoot, file);
		if (/\.(?:ts|tsx|tsrx)$/.test(file) && !file.endsWith('.d.ts')) {
			throw new Error(`React-PDF build leaked raw TypeScript: ${packagePath}`);
		}
		if (!file.endsWith('.js')) continue;
		const source = readFileSync(file, 'utf8');
		if (!source.startsWith('// octane-no-slot:')) {
			throw new Error(`React-PDF build omitted precompiled marker: ${packagePath}`);
		}
		if (packagePath.startsWith('dist/server/') && /\bDOMMatrix\b/.test(source)) {
			throw new Error(`React-PDF server build included browser PDF.js: ${packagePath}`);
		}
	}
}

rmSync(distRoot, { force: true, recursive: true });
await Promise.all([buildRuntime('client'), buildRuntime('server')]);
mkdirSync(join(distRoot, 'Page'), { recursive: true });
copyFileSync(
	join(sourceRoot, 'Page/AnnotationLayer.css'),
	join(distRoot, 'Page/AnnotationLayer.css'),
);
copyFileSync(join(sourceRoot, 'Page/TextLayer.css'), join(distRoot, 'Page/TextLayer.css'));
execFileSync(
	process.execPath,
	[join(import.meta.dirname, 'generate-tsrx-types.mjs'), '--out-dir', 'dist/types'],
	{ cwd: packageRoot, stdio: 'inherit' },
);
assertBuiltPackage();
console.log('react-pdf: built client, server, declarations, and layer styles in dist/');
