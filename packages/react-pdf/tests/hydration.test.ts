import { afterEach, describe, expect, it, vi } from 'vitest';

const loadingTask = vi.hoisted(() => ({
	destroy: vi.fn(async () => {}),
	destroyed: false,
	onPassword: vi.fn(),
	onProgress: vi.fn(),
	promise: new Promise(() => {}),
}));

vi.mock('pdfjs-dist', () => ({
	AnnotationLayer: class {},
	AnnotationMode: { ENABLE: 1, ENABLE_FORMS: 2 },
	GlobalWorkerOptions: { workerSrc: '' },
	PDFDataRangeTransport: class {},
	TextLayer: class {},
	getDocument: vi.fn(() => loadingTask),
	version: '5.4.296',
}));

import { hydrateRoot } from 'octane';
import { ServerDocument } from './_fixtures/server.tsrx';
import { settle } from './_helpers';

const SERVER_HTML =
	'<main id="pdf-shell"><!--[--><div class="react-pdf__Document" data-testid="document"><!--[--><div class="react-pdf__message react-pdf__message--loading">Loading PDF…</div><!--]--></div><!--]--></main>';

afterEach(() => {
	document.body.replaceChildren();
	loadingTask.destroy.mockClear();
});

describe('@octanejs/react-pdf hydration', () => {
	it('adopts the server loading shell and starts PDF work after mount', async () => {
		const container = document.createElement('div');
		container.innerHTML = SERVER_HTML;
		document.body.append(container);
		const documentHost = container.querySelector('.react-pdf__Document');
		const loading = container.querySelector('.react-pdf__message--loading');
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const root = hydrateRoot(container, ServerDocument, { file: '/document.pdf' });
		expect(container.innerHTML).toBe(SERVER_HTML);
		expect(container.querySelector('.react-pdf__Document')).toBe(documentHost);
		expect(container.querySelector('.react-pdf__message--loading')).toBe(loading);
		await settle();
		expect(container.querySelector('.react-pdf__Document')).toBe(documentHost);
		expect(container.querySelector('.react-pdf__message--loading')).toBe(loading);
		expect(error).not.toHaveBeenCalled();
		root.unmount();
		await settle();
		expect(loadingTask.destroy).toHaveBeenCalledOnce();
		error.mockRestore();
	});
});
