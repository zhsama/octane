# @octanejs/react-pdf

Octane bindings for `react-pdf@10.4.1`, backed by `pdfjs-dist@5.4.296`.

```tsrx
import { Document, Page, pdfjs } from '@octanejs/react-pdf';
import '@octanejs/react-pdf/dist/Page/AnnotationLayer.css';
import '@octanejs/react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export function Preview({ url }: { url: string }) {
  return <Document file={url}>
    <Page pageNumber={1} width={720} />
  </Document>;
}
```

The package ships precompiled client and server entries. `Document`, `Page`,
`Thumbnail`, `Outline`, `PasswordResponses`, the three context hooks, and
`LinkService` are available from the root entry. The client entry exposes the
real PDF.js namespace as `pdfjs`; the server entry exposes an inert namespace so
SSR can render deterministic loading/no-data markup without evaluating PDF.js
browser globals. PDF work starts only after mount.

The two CSS compatibility entries ship the focused upstream layer styles and
set React-PDF's layer-presence custom properties without pulling in PDF.js's
full viewer stylesheet.

Differences from `react-pdf@10.4.1`:

- `customTextRenderer` output is sanitized before insertion. The PDF structure
  tree is still rendered as the canvas accessibility fallback.
- Annotation accessibility/editor managers and comment-manager integrations
  remain PDF.js defaults, matching React-PDF's current null placeholders.
- The deprecated `onChange` event-prop alias is not synthesized. Octane forwards
  native host events and keeps all React-PDF load/render callbacks unchanged.
