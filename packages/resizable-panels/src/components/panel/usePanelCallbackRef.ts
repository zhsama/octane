import { useState } from 'octane';
import type { PanelImperativeHandle } from './types';

/**
 * Convenience hook to return a properly typed ref callback for the Panel component.
 *
 * Use this hook when you need to share the ref with another component or hook.
 */
export function usePanelCallbackRef() {
	const [value, setValue] = useState<PanelImperativeHandle | null>(null);
	return [value, setValue] as const;
}
