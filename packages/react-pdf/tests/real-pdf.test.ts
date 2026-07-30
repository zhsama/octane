import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

function minimalPdf(): Uint8Array {
	const objects = [
		'1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
		'2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
		'3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
		'4 0 obj\n<< /Length 35 >>\nstream\nBT /F1 12 Tf 20 50 Td (Octane) Tj ET\nendstream\nendobj\n',
		'5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
	];
	let source = '%PDF-1.4\n';
	const offsets = [0];
	for (const object of objects) {
		offsets.push(new TextEncoder().encode(source).length);
		source += object;
	}
	const xref = new TextEncoder().encode(source).length;
	source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets.slice(1)) {
		source += `${String(offset).padStart(10, '0')} 00000 n \n`;
	}
	source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return new TextEncoder().encode(source);
}

describe('pdfjs-dist integration', () => {
	it('loads a real one-page PDF and extracts its text', async () => {
		const task = getDocument({ data: minimalPdf(), disableWorker: true });
		const pdf = await task.promise;
		expect(pdf.numPages).toBe(1);
		const page = await pdf.getPage(1);
		expect(page.getViewport({ scale: 1 })).toMatchObject({ width: 200, height: 100 });
		const text = await page.getTextContent();
		expect(text.items.map((item) => ('str' in item ? item.str : '')).join('')).toContain('Octane');
		await task.destroy();
	});
});
