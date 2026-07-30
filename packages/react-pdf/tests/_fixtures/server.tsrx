import { Document } from '@octanejs/react-pdf';

export function ServerDocument({ file }: { file: string | null }) {
	return <main id="pdf-shell">
		<Document file={file} data-testid="document">
			<span>loaded only on the client</span>
		</Document>
	</main>;
}
