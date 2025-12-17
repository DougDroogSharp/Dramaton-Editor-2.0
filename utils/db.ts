import { set, get } from 'idb-keyval';
import { GameData } from '../types';

const DB_KEY = 'dramaton_save_v2';

export const saveGameToDB = async (game: GameData) => {
  try {
    await set(DB_KEY, game);
    return true;
  } catch (error) {
    console.error("Failed to save to IndexedDB", error);
    return false;
  }
};

export const loadGameFromDB = async (): Promise<GameData | null> => {
  try {
    const data = await get(DB_KEY);
    return data as GameData || null;
  } catch (error) {
    console.error("Failed to load from IndexedDB", error);
    return null;
  }
};
