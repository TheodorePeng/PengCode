
import { Space, OpenTab } from './types';

// Using standard SVG paths for default icons
const ICONS = {
  Home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  User: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8",
  Code: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  Link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
};

export const DEFAULT_SPACES: Space[] = [
  { id: 'space-home', name: 'Working Space', isDefault: true, icon: ICONS.Home },
  { id: 'space-personal', name: 'Personal', icon: ICONS.User },
  { id: 'space-research', name: 'Research & Dev', icon: ICONS.Code },
  { id: 'space-peng', name: 'Peng Link', icon: ICONS.Link },
];

export const MOCK_OPEN_TABS: OpenTab[] = [
  { id: 'tab-1', windowId: 1, title: 'Orbital Tab Manager', url: 'https://orbital.app', favicon: 'https://react.dev/favicon.ico' },
  { id: 'tab-2', windowId: 1, title: 'toby - Google Search', url: 'https://google.com/search?q=toby', favicon: 'https://google.com/favicon.ico' },
  { id: 'tab-3', windowId: 1, title: 'Toby - The Best Tab Manager', url: 'https://gettoby.com', favicon: 'https://gettoby.com/favicon.ico' },
  { id: 'tab-4', windowId: 2, title: '剑来 第二季 - 腾讯视频', url: 'https://v.qq.com/x/cover/...', favicon: 'https://v.qq.com/favicon.ico' },
  { id: 'tab-5', windowId: 2, title: '剑来 第二季_腾讯视频', url: 'https://v.qq.com/x/page/...', favicon: 'https://v.qq.com/favicon.ico' },
];

export const THEME_COLOR = '#ef4444';
