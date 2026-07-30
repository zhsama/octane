import { createContext } from 'octane';
import type { GroupContextType } from './types';

export const GroupContext = createContext<GroupContextType | null>(null);
