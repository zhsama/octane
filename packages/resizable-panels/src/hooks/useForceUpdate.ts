import { useCallback, useState } from 'octane';

export function useForceUpdate() {
	const [sigil, setSigil] = useState({});

	const forceUpdate = useCallback(() => setSigil({}), []);

	return [sigil as unknown, forceUpdate] as const;
}
