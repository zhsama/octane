import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
	AnnotationLayer: class {},
	AnnotationMode: { ENABLE: 1, ENABLE_FORMS: 2 },
	GlobalWorkerOptions: { workerSrc: '' },
	PDFDataRangeTransport: class {},
	TextLayer: class {},
	getDocument: vi.fn(),
	version: '5.4.296',
}));
import {
	Document,
	LinkService,
	Outline,
	Page,
	PasswordResponses,
	Thumbnail,
	pdfjs,
	useDocumentContext,
	useOutlineContext,
	usePageContext,
} from '@octanejs/react-pdf';

describe('@octanejs/react-pdf public surface', () => {
	it('exports the React-PDF 10 adapter surface and mutable worker option', () => {
		expect([
			Document,
			Outline,
			Page,
			Thumbnail,
			useDocumentContext,
			useOutlineContext,
			usePageContext,
		]).not.toContain(undefined);
		expect(PasswordResponses).toEqual({ NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 });
		pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.mjs';
		expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe('/assets/pdf.worker.mjs');
	});

	it('applies external-link rel/target and internal destinations', async () => {
		const destination = [{ num: 2, gen: 0 }] as never;
		const scrollPageIntoView = vi.fn();
		const linkService = new LinkService();
		linkService.setDocument({
			getDestination: vi.fn(async () => destination),
			getPageIndex: vi.fn(async () => 1),
			numPages: 2,
		} as never);
		linkService.setViewer({ scrollPageIntoView });
		linkService.setExternalLinkRel('external');
		linkService.setExternalLinkTarget('_top');
		const anchor = document.createElement('a');
		linkService.addLinkAttributes(anchor, 'https://example.com/', false);
		expect(anchor.rel).toBe('external');
		expect(anchor.target).toBe('_top');
		await linkService.goToDestination('chapter');
		expect(scrollPageIntoView).toHaveBeenCalledWith({
			dest: destination,
			pageIndex: 1,
			pageNumber: 2,
		});
	});

	it('ships both compatible CSS subpaths', () => {
		for (const name of ['AnnotationLayer.css', 'TextLayer.css']) {
			const source = readFileSync(resolve(import.meta.dirname, `../src/Page/${name}`), 'utf8');
			expect(source).not.toContain('pdf_viewer.css');
			expect(source).toContain(name.startsWith('Annotation') ? '.annotationLayer' : '.textLayer');
			expect(source).toContain(
				`--react-pdf-${name.startsWith('Annotation') ? 'annotation' : 'text'}-layer`,
			);
		}
	});
});
