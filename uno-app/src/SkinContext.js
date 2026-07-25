import { createContext, useContext } from 'react';

// Equipped card-back skin id, provided at the app root so every CardBack picks it up.
export const SkinContext = createContext('classic');
export const useEquippedSkin = () => useContext(SkinContext);
