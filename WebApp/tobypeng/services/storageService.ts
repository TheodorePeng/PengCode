import { Space, Collection, Link } from '../types';

declare const chrome: any;

const STORAGE_KEYS = {
  SPACES: 'orbital_spaces',
  COLLECTIONS: 'orbital_collections',
  LINKS: 'orbital_links',
};

// Helper to check if chrome.storage is available (extension mode)
const isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

export const storageService = {
  // --- Standard Storage Methods ---
  getSpaces: async (): Promise<Space[]> => {
    if (isExtension) {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SPACES);
      return result[STORAGE_KEYS.SPACES] || [];
    }
    const data = localStorage.getItem(STORAGE_KEYS.SPACES);
    return data ? JSON.parse(data) : [];
  },
  setSpaces: async (spaces: Space[]) => {
    if (isExtension) {
      await chrome.storage.local.set({ [STORAGE_KEYS.SPACES]: spaces });
    } else {
      localStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify(spaces));
    }
  },

  getCollections: async (): Promise<Collection[]> => {
    if (isExtension) {
      const result = await chrome.storage.local.get(STORAGE_KEYS.COLLECTIONS);
      return result[STORAGE_KEYS.COLLECTIONS] || [];
    }
    const data = localStorage.getItem(STORAGE_KEYS.COLLECTIONS);
    return data ? JSON.parse(data) : [];
  },
  setCollections: async (collections: Collection[]) => {
    if (isExtension) {
      await chrome.storage.local.set({ [STORAGE_KEYS.COLLECTIONS]: collections });
    } else {
      localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections));
    }
  },

  getLinks: async (): Promise<Link[]> => {
    if (isExtension) {
      const result = await chrome.storage.local.get(STORAGE_KEYS.LINKS);
      return result[STORAGE_KEYS.LINKS] || [];
    }
    const data = localStorage.getItem(STORAGE_KEYS.LINKS);
    return data ? JSON.parse(data) : [];
  },
  setLinks: async (links: Link[]) => {
    if (isExtension) {
      await chrome.storage.local.set({ [STORAGE_KEYS.LINKS]: links });
    } else {
      localStorage.setItem(STORAGE_KEYS.LINKS, JSON.stringify(links));
    }
  },

  // --- Backup & Restore Methods ---
  exportAllData: async () => {
    const spaces = await storageService.getSpaces();
    const collections = await storageService.getCollections();
    const links = await storageService.getLinks();
    
    const backup = {
      version: '1.0',
      timestamp: Date.now(),
      data: { spaces, collections, links }
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbital_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData: async (jsonString: string): Promise<boolean> => {
    try {
      const backup = JSON.parse(jsonString);
      if (!backup.data || !backup.data.spaces) throw new Error('Invalid backup format');
      
      const { spaces, collections, links } = backup.data;
      await storageService.setSpaces(spaces);
      await storageService.setCollections(collections);
      await storageService.setLinks(links);
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }
};