import { useState } from 'octane';
import type { GroupImperativeHandle } from './types';

/**
 * Convenience hook to return a properly typed ref callback for the Group component.
 *
 * Use this hook when you need to share the ref with another component or hook.
 */
export function useGroupCallbackRef() {
	const [value, setValue] = useState<GroupImperativeHandle | null>(null);
	return [value, setValue] as const;
}
