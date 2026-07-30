import { describe, expect, it } from 'vitest';
import { renderToString } from 'octane/server';
import { pdfjs } from '@octanejs/react-pdf';
import { ServerDocument } from '../_fixtures/server.tsrx';

describe('@octanejs/react-pdf SSR', () => {
	it('renders deterministic loading and no-data shells without browser globals', () => {
		const loading = renderToString(ServerDocument, { file: '/document.pdf' }).html;
		const noData = renderToString(ServerDocument, { file: null }).html;
		expect(loading).toContain('react-pdf__message--loading');
		expect(loading).toContain('Loading PDF');
		expect(noData).toContain('react-pdf__message--no-data');
		expect(noData).toContain('No PDF file specified');
		expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe('pdf.worker.mjs');
	});
});
