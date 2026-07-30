import { useId as useIdReact } from 'octane';

export function useId(stableId: number | string | undefined) {
	const dynamicId = useIdReact();

	return `${stableId ?? dynamicId}`;
}
