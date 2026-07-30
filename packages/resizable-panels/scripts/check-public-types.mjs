import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const packageRoot = resolve(import.meta.dirname, '..');
const localIndex = resolve(packageRoot, 'src/index.ts');
const containingFile = resolve(packageRoot, 'tests/types/public-api.test-d.ts');
const compilerOptions = {
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	skipLibCheck: true,
	target: ts.ScriptTarget.ESNext,
};

const upstream = ts.resolveModuleName(
	'react-resizable-panels',
	containingFile,
	compilerOptions,
	ts.sys,
).resolvedModule;
assert.ok(upstream, 'Unable to resolve react-resizable-panels');

const upstreamProgram = ts.createProgram([upstream.resolvedFileName], compilerOptions);
const upstreamChecker = upstreamProgram.getTypeChecker();
const upstreamSource = upstreamProgram.getSourceFile(upstream.resolvedFileName);
assert.ok(upstreamSource, 'TypeScript omitted react-resizable-panels');
const upstreamSymbol = upstreamChecker.getSymbolAtLocation(upstreamSource);
assert.ok(upstreamSymbol, 'react-resizable-panels has no module symbol');
const upstreamNames = upstreamChecker
	.getExportsOfModule(upstreamSymbol)
	.map((entry) => entry.getName())
	.sort();

const localSource = ts.createSourceFile(
	localIndex,
	readFileSync(localIndex, 'utf8'),
	ts.ScriptTarget.Latest,
	true,
	ts.ScriptKind.TS,
);
const localNames = localSource.statements
	.flatMap((statement) => {
		if (
			!ts.isExportDeclaration(statement) ||
			!statement.exportClause ||
			!ts.isNamedExports(statement.exportClause)
		) {
			return [];
		}
		return statement.exportClause.elements.map((element) => element.name.text);
	})
	.sort();

assert.deepEqual(
	localNames,
	upstreamNames,
	'Public export names differ from react-resizable-panels@4.12.0',
);

for (const relativeFile of [
	'src/components/group/useGroupCallbackRef.ts',
	'src/components/panel/usePanelCallbackRef.ts',
]) {
	const file = resolve(packageRoot, relativeFile);
	const program = ts.createProgram([file], compilerOptions);
	const checker = program.getTypeChecker();
	const source = program.getSourceFile(file);
	assert.ok(source, `TypeScript omitted ${relativeFile}`);
	const declaration = source.statements.find(
		(statement) =>
			ts.isFunctionDeclaration(statement) && statement.name?.text.endsWith('CallbackRef'),
	);
	assert.ok(declaration, `Missing callback-ref hook in ${relativeFile}`);
	const signature = checker.getSignatureFromDeclaration(declaration);
	assert.ok(signature, `Missing callback-ref signature in ${relativeFile}`);
	const returnType = checker.getReturnTypeOfSignature(signature);
	assert.ok(
		checker.isTupleType(returnType) && (returnType.typeArguments?.length ?? 0) === 2,
		`${relativeFile} must return the upstream two-member callback-ref tuple`,
	);
}

console.log(
	`Resizable panels public exports match upstream (${localNames.length} exports); callback-ref hooks return two-member tuples.`,
);
