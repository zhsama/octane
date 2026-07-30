import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
	AnnotationLayer: class {},
	AnnotationMode: { ENABLE: 1, ENABLE_FORMS: 2 },
	GlobalWorkerOptions: { workerSrc: '' },
	PDFDataRangeTransport: class {},
	TextLayer: class {},
	getDocument: vi.fn(),
	version: '5.4.296',
}));

import { Outline, Thumbnail } from '@octanejs/react-pdf';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { mount, settle } from './_helpers';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((nextResolve) => {
		resolve = nextResolve;
	});
	return { promise, resolve };
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('outline and thumbnail navigation', () => {
	it('renders nested outline items and keeps only the latest async click', async () => {
		const first = deferred<any[]>();
		const second = deferred<any[]>();
		const getDestination = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const pdf = {
			getDestination,
			getOutline: vi.fn(async () => [
				{
					dest: 'chapter',
					items: [{ dest: [2], items: [], title: 'Child' }],
					title: 'Chapter',
				},
			]),
			getPageIndex: vi.fn(async (reference: { num: number }) => reference.num),
			numPages: 4,
		} as unknown as PDFDocumentProxy;
		const oldCallback = vi.fn();
		const newCallback = vi.fn();
		const result = mount(Outline, {
			'data-testid': 'outline',
			onItemClick: oldCallback,
			pdf,
		});
		await settle();
		expect([...result.container.querySelectorAll('a')].map((anchor) => anchor.textContent)).toEqual(
			['Chapter', 'Child'],
		);
		const chapter = result.container.querySelector('a') as HTMLAnchorElement;
		chapter.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		chapter.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		result.update(Outline, {
			'data-testid': 'outline',
			onItemClick: newCallback,
			pdf,
		});
		await settle();
		second.resolve([{ num: 2, gen: 0 }]);
		await settle();
		first.resolve([{ num: 1, gen: 0 }]);
		await settle();
		expect(oldCallback).not.toHaveBeenCalled();
		expect(newCallback).toHaveBeenCalledOnce();
		expect(newCallback).toHaveBeenCalledWith({
			dest: [{ num: 2, gen: 0 }],
			pageIndex: 2,
			pageNumber: 3,
		});
		expect(result.container.querySelector('[data-testid="outline"]')).not.toBeNull();
		result.unmount();
	});

	it('navigates a thumbnail without rendering text or annotations', async () => {
		const page = {
			getViewport: vi.fn(({ scale }: { scale: number }) => ({
				height: 200 * scale,
				width: 100 * scale,
			})),
			rotate: 0,
		} as unknown as PDFPageProxy;
		const pdf = {
			getPage: vi.fn(async () => page),
			numPages: 3,
		} as unknown as PDFDocumentProxy;
		const clicked = vi.fn();
		const result = mount(Thumbnail, {
			onItemClick: clicked,
			pageNumber: 2,
			pdf,
			renderMode: 'none',
		});
		await settle();
		const anchor = result.container.querySelector('.react-pdf__Thumbnail') as HTMLAnchorElement;
		anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(clicked).toHaveBeenCalledWith({ pageIndex: 1, pageNumber: 2 });
		expect(result.container.querySelector('.textLayer')).toBeNull();
		expect(result.container.querySelector('.annotationLayer')).toBeNull();
		result.unmount();
	});
});
