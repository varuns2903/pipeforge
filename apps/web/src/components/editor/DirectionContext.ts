import { createContext, useContext } from 'react';
export const DirectionContext = createContext<'TB' | 'LR'>('TB');
export const useDirection = () => useContext(DirectionContext);
