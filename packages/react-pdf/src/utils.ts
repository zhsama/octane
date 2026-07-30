import type { PDFDataRangeTransport, PDFPageProxy } from 'pdfjs-dist';
import type { OctaneNode } from 'octane';
import type { File, NodeOrRenderer, PageCallback, Source } from './types';

export const isBrowser = typeof window !== 'undefined';

export function invariant(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

export function warn(error: unknown): void {
	if (typeof console !== 'undefined')
		console.warn(error instanceof Error ? error.message : String(error));
}

export function isProvided<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}

export function isAbortException(error: unknown): boolean {
	return (
		error instanceof Error &&
		(error.name === 'AbortException' || error.name === 'RenderingCancelledException')
	);
}

export function getDevicePixelRatio(): number {
	return isBrowser ? window.devicePixelRatio || 1 : 1;
}

export function resolveNode(value: NodeOrRenderer): OctaneNode {
	return typeof value === 'function' ? value() : value;
}

export function makePageCallback(page: PDFPageProxy, scale: number): PageCallback {
	Object.defineProperties(page, {
		width: { configurable: true, get: () => page.getViewport({ scale }).width },
		height: { configurable: true, get: () => page.getViewport({ scale }).height },
		originalWidth: { configurable: true, get: () => page.getViewport({ scale: 1 }).width },
		originalHeight: { configurable: true, get: () => page.getViewport({ scale: 1 }).height },
	});
	return page as PageCallback;
}

function dataUriToBytes(uri: string): string {
	const comma = uri.indexOf(',');
	invariant(comma >= 0, 'Invalid data URI.');
	const header = uri.slice(0, comma);
	const body = uri.slice(comma + 1);
	return header.split(';').includes('base64') ? atob(body) : decodeURIComponent(body);
}

function isParameterObject(file: File): file is Source {
	return (
		typeof file === 'object' &&
		file !== null &&
		('data' in file || 'range' in file || 'url' in file)
	);
}

export async function resolveDocumentSource(file: File): Promise<Source | null> {
	if (file === null || file === '') return null;
	if (typeof file === 'string') {
		return file.startsWith('data:') ? { data: dataUriToBytes(file) } : { url: file };
	}
	if (file instanceof URL) return { url: file };
	if (file instanceof ArrayBuffer || ArrayBuffer.isView(file)) return { data: file };
	if (typeof Blob !== 'undefined' && file instanceof Blob)
		return { data: await file.arrayBuffer() };
	if (isParameterObject(file)) {
		if (typeof file.url === 'string' && file.url.startsWith('data:')) {
			const { url: _url, ...rest } = file;
			return { ...rest, data: dataUriToBytes(file.url) };
		}
		return file;
	}
	return { range: file as PDFDataRangeTransport };
}
