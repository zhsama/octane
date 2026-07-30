import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pdfjsHarness = vi.hoisted(() => ({
	annotationConstructors: [] as Array<Record<string, unknown>>,
	annotationRenderQueue: [] as Promise<void>[],
	annotationRenders: [] as Array<Record<string, unknown>>,
	getDocument: vi.fn(),
	textConstructors: [] as Array<Record<string, unknown>>,
	textTasks: [] as Array<{ cancel: ReturnType<typeof vi.fn> }>,
}));

vi.mock('pdfjs-dist', () => {
	class TextLayer {
		#parameters: Record<string, any>;
		cancel = vi.fn();
		constructor(parameters: Record<string, any>) {
			this.#parameters = parameters;
			pdfjsHarness.textConstructors.push(parameters);
			pdfjsHarness.textTasks.push(this);
		}
		async render() {
			const span = document.createElement('span');
			span.setAttribute('role', 'presentation');
			span.textContent = this.#parameters.textContentSource.label;
			this.#parameters.container.append(span);
		}
	}
	class AnnotationLayer {
		#parameters: Record<string, any>;
		constructor(parameters: Record<string, any>) {
			this.#parameters = parameters;
			pdfjsHarness.annotationConstructors.push(parameters);
		}
		render(parameters: Record<string, any>) {
			pdfjsHarness.annotationRenders.push(parameters);
			const completion = pdfjsHarness.annotationRenderQueue.shift() ?? Promise.resolve();
			return completion.then(() => {
				const section = document.createElement('section');
				section.dataset.annotation = parameters.annotations[0]?.id ?? 'none';
				this.#parameters.div.append(section);
			});
		}
	}
	return {
		AnnotationLayer,
		AnnotationMode: { DISABLE: 0, ENABLE: 1, ENABLE_FORMS: 2, ENABLE_STORAGE: 3 },
		GlobalWorkerOptions: { workerSrc: '' },
		PDFDataRangeTransport: class {},
		TextLayer,
		getDocument: pdfjsHarness.getDocument,
		version: '5.4.296',
	};
});

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type {
	DocumentHandle,
	LinkService as LinkServiceType,
	PageCallback,
} from '@octanejs/react-pdf';
import { DocumentFixture, PageFixture, TwoDocuments } from './_fixtures/viewer.tsrx';
import { mount, settle } from './_helpers';

type Deferred<T> = {
	promise: Promise<T>;
	reject: (error: unknown) => void;
	resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((nextResolve, nextReject) => {
		resolve = nextResolve;
		reject = nextReject;
	});
	return { promise, reject, resolve };
}

function loadingTask() {
	const value = deferred<PDFDocumentProxy>();
	const task = {
		destroyed: false,
		destroy: vi.fn(async () => {
			task.destroyed = true;
		}),
		onPassword: vi.fn(),
		onProgress: vi.fn(),
		promise: value.promise,
	};
	return { ...value, task };
}

type FakePage = PDFPageProxy & {
	id: string;
	annotationDeferred?: Deferred<any[]>;
	renderDeferreds: Deferred<void>[];
	textDeferred?: Deferred<any>;
};

function makePage(id: string, overrides: Partial<FakePage> = {}): FakePage {
	const renderDeferreds: Deferred<void>[] = overrides.renderDeferreds ?? [];
	const page = {
		id,
		rotate: 0,
		cleanup: vi.fn(),
		getAnnotations: vi.fn(() =>
			overrides.annotationDeferred
				? overrides.annotationDeferred.promise
				: Promise.resolve([{ id }]),
		),
		getStructTree: vi.fn(() => Promise.resolve(null)),
		getTextContent: vi.fn(() =>
			overrides.textDeferred
				? overrides.textDeferred.promise
				: Promise.resolve({
						items: [{ str: id, dir: 'ltr', transform: [], width: 1, height: 1, fontName: 'f' }],
						styles: {},
					}),
		),
		getViewport: vi.fn(({ scale, rotation = 0 }: { scale: number; rotation?: number }) => {
			const viewport = {
				height: 200 * scale,
				rotation,
				width: 100 * scale,
				clone: vi.fn(() => ({ ...viewport })),
			};
			return viewport;
		}),
		render: vi.fn(() => {
			const next = deferred<void>();
			renderDeferreds.push(next);
			return { cancel: vi.fn(), promise: next.promise };
		}),
		streamTextContent: vi.fn(() => ({ label: id })),
		...overrides,
		renderDeferreds,
	} as unknown as FakePage;
	return page;
}

function makePdf(
	id: string,
	getPage: (pageNumber: number) => Promise<PDFPageProxy>,
): PDFDocumentProxy {
	return {
		id,
		annotationStorage: {},
		getDestination: vi.fn(),
		getOutline: vi.fn(() => Promise.resolve(null)),
		getPage: vi.fn(getPage),
		getPageIndex: vi.fn(),
		numPages: 3,
	} as unknown as PDFDocumentProxy;
}

let getContext: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	pdfjsHarness.annotationConstructors.length = 0;
	pdfjsHarness.annotationRenderQueue.length = 0;
	pdfjsHarness.annotationRenders.length = 0;
	pdfjsHarness.getDocument.mockReset();
	pdfjsHarness.textConstructors.length = 0;
	pdfjsHarness.textTasks.length = 0;
	getContext = vi
		.spyOn(HTMLCanvasElement.prototype, 'getContext')
		.mockReturnValue({} as CanvasRenderingContext2D);
});

afterEach(() => {
	getContext.mockRestore();
	document.body.replaceChildren();
});

describe('Document lifecycle', () => {
	it('destroys file A and ignores its completion after file B wins', async () => {
		const tasks = new Map<string, ReturnType<typeof loadingTask>>();
		pdfjsHarness.getDocument.mockImplementation((source: { url: string }) => {
			const task = loadingTask();
			tasks.set(source.url, task);
			return task.task;
		});
		const loaded: string[] = [];
		const sourceSuccess: string[] = [];
		const result = mount(DocumentFixture, {
			file: '/a.pdf',
			onLoadSuccess: (pdf) => loaded.push((pdf as PDFDocumentProxy & { id: string }).id),
			onSourceSuccess: () => sourceSuccess.push('source'),
		});
		await settle();
		expect(tasks.has('/a.pdf')).toBe(true);

		result.update(DocumentFixture, {
			file: '/b.pdf',
			onLoadSuccess: (pdf) => loaded.push((pdf as PDFDocumentProxy & { id: string }).id),
			onSourceSuccess: () => sourceSuccess.push('source'),
		});
		expect(result.container.querySelector('.react-pdf__message--loading')).not.toBeNull();
		await settle();
		expect(tasks.get('/a.pdf')?.task.destroy).toHaveBeenCalledOnce();
		const pageB = makePage('page-b');
		tasks.get('/b.pdf')?.resolve(makePdf('B', async () => pageB));
		await settle();
		expect(result.container.querySelector('#document-id')?.textContent).toBe('B');
		expect(loaded).toEqual(['B']);

		tasks.get('/a.pdf')?.resolve(makePdf('A', async () => makePage('page-a')));
		await settle();
		expect(result.container.querySelector('#document-id')?.textContent).toBe('B');
		expect(loaded).toEqual(['B']);
		expect(sourceSuccess).toHaveLength(2);
		result.unmount();
	});

	it('wires progress/password callbacks and reloads when options identity changes', async () => {
		const tasks: ReturnType<typeof loadingTask>[] = [];
		pdfjsHarness.getDocument.mockImplementation(() => {
			const task = loadingTask();
			tasks.push(task);
			return task.task;
		});
		const progress = vi.fn();
		const password = vi.fn();
		const firstOptions = { cMapUrl: '/first/' };
		const result = mount(DocumentFixture, {
			file: '/document.pdf',
			onLoadProgress: progress,
			onPassword: password,
			options: firstOptions,
		});
		await settle();
		expect(tasks).toHaveLength(1);
		tasks[0].task.onProgress({ loaded: 5, total: 10 });
		const updatePassword = vi.fn();
		tasks[0].task.onPassword(updatePassword, 1);
		expect(progress).toHaveBeenCalledWith({ loaded: 5, total: 10 });
		expect(password).toHaveBeenCalledWith(updatePassword, 1);

		const secondOptions = { cMapUrl: '/second/' };
		result.update(DocumentFixture, {
			file: '/document.pdf',
			onLoadProgress: progress,
			onPassword: password,
			options: secondOptions,
		});
		await settle();
		expect(tasks[0].task.destroy).toHaveBeenCalledOnce();
		expect(tasks).toHaveLength(2);
		expect(pdfjsHarness.getDocument).toHaveBeenLastCalledWith({
			url: '/document.pdf',
			...secondOptions,
		});
		result.unmount();
	});

	it('keeps sibling documents, handles, pages, and loading tasks isolated', async () => {
		const tasks = new Map<string, ReturnType<typeof loadingTask>>();
		pdfjsHarness.getDocument.mockImplementation((source: { url: string }) => {
			const task = loadingTask();
			tasks.set(source.url, task);
			return task.task;
		});
		const handles: DocumentHandle[] = [];
		const loaded: string[] = [];
		const result = mount(TwoDocuments, {
			firstRef: (handle) => {
				if (handle) handles[0] = handle;
			},
			onLoad: (id) => loaded.push(id),
			secondRef: (handle) => {
				if (handle) handles[1] = handle;
			},
		});
		await settle();
		tasks.get('/second.pdf')?.resolve(makePdf('second', async () => makePage('second-page')));
		tasks.get('/first.pdf')?.resolve(makePdf('first', async () => makePage('first-page')));
		await settle();
		expect(loaded.sort()).toEqual(['first', 'second']);
		expect(handles).toHaveLength(2);
		expect(handles[0].linkService.current).not.toBe(handles[1].linkService.current);
		expect(handles[0].pages.current).not.toBe(handles[1].pages.current);
		result.unmount();
		await settle();
		expect(tasks.get('/first.pdf')?.task.destroy).toHaveBeenCalledOnce();
		expect(tasks.get('/second.pdf')?.task.destroy).toHaveBeenCalledOnce();
	});
});

describe('Page and layer lifecycle', () => {
	it('ignores page 1 after page 2 resolves and reports the scaled callback', async () => {
		const first = deferred<PDFPageProxy>();
		const second = deferred<PDFPageProxy>();
		const pdf = makePdf('doc', (pageNumber) => (pageNumber === 1 ? first.promise : second.promise));
		const loaded: string[] = [];
		const widths: number[] = [];
		const result = mount(PageFixture, {
			onLoadSuccess: (page: PageCallback) => {
				loaded.push((page as FakePage).id);
				widths.push(page.width);
			},
			pageNumber: 1,
			pdf,
			width: 300,
		});
		await settle();
		result.update(PageFixture, {
			onLoadSuccess: (page: PageCallback) => {
				loaded.push((page as FakePage).id);
				widths.push(page.width);
			},
			pageNumber: 2,
			pdf,
			width: 300,
		});
		const page2 = makePage('page-2');
		second.resolve(page2);
		await settle();
		first.resolve(makePage('page-1'));
		await settle();
		expect(result.container.querySelector('#page-id')?.textContent).toBe('page-2');
		expect(loaded).toEqual(['page-2']);
		expect(widths).toEqual([300]);
		result.unmount();
	});

	it('applies DPR, forms, layer flags, and prevents an old canvas render from winning', async () => {
		const tree = {
			alt: 'Document heading',
			children: [{ id: 'text-1', type: 'content' }],
			role: 'H2',
		};
		const page = makePage('visible', {
			getStructTree: vi.fn(async () => tree),
		} as Partial<FakePage>);
		const pdf = makePdf('doc', async () => page);
		const canvasRendered: string[] = [];
		const textRendered = vi.fn();
		const annotationsRendered = vi.fn();
		const structTreeLoaded = vi.fn();
		const result = mount(PageFixture, {
			devicePixelRatio: 2,
			onGetStructTreeSuccess: structTreeLoaded,
			onRenderAnnotationLayerSuccess: annotationsRendered,
			onRenderSuccess: (nextPage) => canvasRendered.push((nextPage as FakePage).id),
			onRenderTextLayerSuccess: textRendered,
			pageNumber: 1,
			pdf,
			renderAnnotationLayer: true,
			renderForms: true,
			renderMode: 'canvas',
			renderTextLayer: true,
			width: 200,
		});
		await settle();
		const canvas = result.container.querySelector('canvas') as HTMLCanvasElement;
		expect(canvas.width).toBe(400);
		expect(canvas.height).toBe(800);
		expect(canvas.style.width).toBe('200px');
		expect(canvas.style.height).toBe('400px');
		expect(page.render).toHaveBeenLastCalledWith(
			expect.objectContaining({ annotationMode: 2, canvas }),
		);
		expect(pdfjsHarness.annotationRenders.at(-1)).toEqual(
			expect.objectContaining({ renderForms: true }),
		);
		expect(result.container.querySelector('.textLayer')).not.toBeNull();
		expect(result.container.querySelector('.annotationLayer')).not.toBeNull();
		const structTree = result.container.querySelector('.structTree');
		expect(structTree?.getAttribute('role')).toBe('heading');
		expect(structTree?.getAttribute('aria-level')).toBe('2');
		expect(structTree?.getAttribute('aria-label')).toBe('Document heading');
		expect(structTree?.getAttribute('aria-owns')).toBe('text-1');
		expect(textRendered).toHaveBeenCalledOnce();
		expect(annotationsRendered).toHaveBeenCalledOnce();
		expect(structTreeLoaded).toHaveBeenCalledWith(tree);

		result.update(PageFixture, {
			devicePixelRatio: 2,
			onGetStructTreeSuccess: structTreeLoaded,
			onRenderAnnotationLayerSuccess: annotationsRendered,
			onRenderSuccess: (nextPage) => canvasRendered.push((nextPage as FakePage).id),
			onRenderTextLayerSuccess: textRendered,
			pageNumber: 1,
			pdf,
			renderAnnotationLayer: false,
			renderForms: true,
			renderMode: 'canvas',
			renderTextLayer: false,
			width: 300,
		});
		await settle();
		expect(result.container.querySelector('.textLayer')).toBeNull();
		expect(result.container.querySelector('.annotationLayer')).toBeNull();
		expect(page.getAnnotations).toHaveBeenCalledOnce();
		expect(page.getStructTree).toHaveBeenCalledOnce();
		expect(page.getTextContent).toHaveBeenCalledOnce();
		expect(page.renderDeferreds).toHaveLength(2);

		page.renderDeferreds[1].resolve();
		await settle();
		page.renderDeferreds[0].resolve();
		await settle();
		expect(canvasRendered).toEqual(['visible']);
		expect((result.container.querySelector('canvas') as HTMLCanvasElement).style.width).toBe(
			'300px',
		);
		result.unmount();
	});

	it('does not report an obsolete asynchronous annotation render as successful', async () => {
		const firstRender = deferred<void>();
		const secondRender = deferred<void>();
		pdfjsHarness.annotationRenderQueue.push(firstRender.promise, secondRender.promise);
		const page1 = makePage('A');
		const page2 = makePage('B');
		const pdf = makePdf('doc', async (pageNumber) => (pageNumber === 1 ? page1 : page2));
		const rendered = vi.fn();
		const result = mount(PageFixture, {
			onRenderAnnotationLayerSuccess: rendered,
			pageNumber: 1,
			pdf,
			renderAnnotationLayer: true,
			renderMode: 'none',
			renderTextLayer: false,
		});
		await settle();
		result.update(PageFixture, {
			onRenderAnnotationLayerSuccess: rendered,
			pageNumber: 2,
			pdf,
			renderAnnotationLayer: true,
			renderMode: 'none',
			renderTextLayer: false,
		});
		await settle();
		secondRender.resolve();
		await settle();
		expect(rendered).toHaveBeenCalledOnce();
		expect(result.container.querySelector('[data-annotation="B"]')).not.toBeNull();
		firstRender.resolve();
		await settle();
		expect(rendered).toHaveBeenCalledOnce();
		expect(result.container.querySelector('[data-annotation="A"]')).toBeNull();
		expect(result.container.querySelector('[data-annotation="B"]')).not.toBeNull();
		result.unmount();
	});

	it('keeps standalone destination work across same-PDF rerenders and cancels it on PDF change', async () => {
		const samePdfDestination = deferred<any[]>();
		const oldPdfDestination = deferred<any[]>();
		const page1 = makePage('A');
		const page2 = makePage('B');
		const pdf1 = makePdf('first', async () => page1);
		const pdf2 = makePdf('second', async () => page2);
		vi.mocked(pdf1.getDestination)
			.mockReturnValueOnce(samePdfDestination.promise)
			.mockReturnValueOnce(oldPdfDestination.promise);
		vi.mocked(pdf1.getPageIndex).mockImplementation(
			async (reference) => (reference as { num: number }).num,
		);
		const result = mount(PageFixture, {
			pageNumber: 1,
			pdf: pdf1,
			renderAnnotationLayer: true,
			renderMode: 'none',
			renderTextLayer: false,
			width: 100,
		});
		await settle();
		const linkService = pdfjsHarness.annotationConstructors.at(-1)?.linkService as LinkServiceType;
		const scrollPageIntoView = vi.fn();
		linkService.setViewer({ scrollPageIntoView });

		const samePdfNavigation = linkService.goToDestination('same-pdf');
		result.update(PageFixture, {
			pageNumber: 1,
			pdf: pdf1,
			renderAnnotationLayer: true,
			renderMode: 'none',
			renderTextLayer: false,
			width: 200,
		});
		await settle();
		samePdfDestination.resolve([{ num: 0, gen: 0 }]);
		await samePdfNavigation;
		expect(scrollPageIntoView).toHaveBeenCalledOnce();

		const oldPdfNavigation = linkService.goToDestination('old-pdf');
		result.update(PageFixture, {
			pageNumber: 1,
			pdf: pdf2,
			renderAnnotationLayer: true,
			renderMode: 'none',
			renderTextLayer: false,
			width: 200,
		});
		await settle();
		oldPdfDestination.resolve([{ num: 1, gen: 0 }]);
		await oldPdfNavigation;
		expect(scrollPageIntoView).toHaveBeenCalledOnce();
		result.unmount();
	});

	it('drops stale text and annotations when page identity changes', async () => {
		const text1 = deferred<any>();
		const annotations1 = deferred<any[]>();
		const text2 = deferred<any>();
		const annotations2 = deferred<any[]>();
		const page1 = makePage('A', { annotationDeferred: annotations1, textDeferred: text1 });
		const page2 = makePage('B', { annotationDeferred: annotations2, textDeferred: text2 });
		const pdf = makePdf('doc', async (pageNumber) => (pageNumber === 1 ? page1 : page2));
		const result = mount(PageFixture, {
			pageNumber: 1,
			pdf,
			renderAnnotationLayer: true,
			renderMode: 'none',
			renderTextLayer: true,
		});
		await settle();
		result.update(PageFixture, {
			pageNumber: 2,
			pdf,
			renderAnnotationLayer: true,
			renderMode: 'none',
			renderTextLayer: true,
		});
		await settle();
		text2.resolve({
			items: [{ str: 'B', dir: 'ltr', transform: [], width: 1, height: 1, fontName: 'f' }],
			styles: {},
		});
		annotations2.resolve([{ id: 'B' }]);
		await settle();
		expect(result.container.querySelector('.textLayer')?.textContent).toContain('B');
		expect(result.container.querySelector('[data-annotation="B"]')).not.toBeNull();

		text1.resolve({
			items: [{ str: 'A', dir: 'ltr', transform: [], width: 1, height: 1, fontName: 'f' }],
			styles: {},
		});
		annotations1.resolve([{ id: 'A' }]);
		await settle();
		expect(result.container.querySelector('.textLayer')?.textContent).not.toContain('A');
		expect(result.container.querySelector('[data-annotation="A"]')).toBeNull();
		result.unmount();
	});
});
