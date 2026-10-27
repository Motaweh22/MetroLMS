import { createContext } from 'react';
import type { AuthContextValue } from './types';

/**
 * React Context for Authentication State
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
