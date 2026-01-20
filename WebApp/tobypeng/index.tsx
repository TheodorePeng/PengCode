import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { Space, Collection, Link, OpenTab, ViewMode } from './types';
import { DEFAULT_SPACES, MOCK_OPEN_TABS } from './constants';
import { storageService } from './services/storageService';

declare const chrome: any;

// --- Interfaces ---
interface CollectionCardProps {
  collection: Collection;
  links: Link[];
  isExpanded: boolean;
  highlightedItemId: string | null;
  onToggleExpand: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
  onRemoveLink: (id: string) => void;
  onAddFromTab: (tab: OpenTab) => void;
  onDragCollectionStart: (id: string) => void;
  onDragLinkStart: (id: string) => void;
  onMoveCollection: (targetId: string) => void;
  onMoveLink: (targetLinkId: string) => void;
  onMoveLinkToCollection: (collectionId: string) => void;
  onDropEnd: () => void;
  onDropTab: () => void;
  // New props for modal
  onAddLink: (collectionId: string) => void;
  onEditLink: (link: Link) => void;
  onExportCSV: (collectionId: string) => void;
}

interface TableViewProps {
  links: Link[];
  collections: Collection[];
  highlightedItemId: string | null;
  onRemoveLink: (id: string) => void;
  onUpdateLink: (id: string, data: { title: string; url: string; comment: string }) => void;
}

// --- Icons ---
const Icon = ({ path, className = "w-4 h-4" }: { path: string, className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

const Paths = {
  Search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  Grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  Table: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18",
  Star: "M12 2l3.09 6.26L22 9.27l-5 4.87l1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87l6.91-1.01L12 2z",
  Trash: "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
  Plus: "M12 5v14M5 12h14",
  Settings: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z",
  Save: "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z M17 21v-8H7v8",
  ArrowLeft: "M19 12H5M12 19l-7-7 7-7",
  External: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6 M15 3h6v6 M10 14L21 3",
  Folder: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  SidebarLeft: "M9 19l-7-7 7-7 M15 19l-7-7 7-7",
  SidebarRight: "M15 19l7-7-7-7 M9 19l7-7-7-7",
  ChevronDown: "M6 9l6 6 6-6",
  OpenAll: "M7 17L17 7M17 7H7M17 7V17",
  Download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  Sort: "M3 6h18M6 12h12M9 18h6",
  Link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
  More: "M12 12h.01M12 19h.01M12 5h.01",
  Share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13",
  Edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  Upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  Terminal: "M4 17l6-6-6-6 M12 19h8",
  Close: "M6 18L18 6M6 6l12 12",
  Check: "M5 13l4 4L19 7"
};

const AVAILABLE_ICONS = [
  { name: 'Folder', path: Paths.Folder },
  { name: 'Home', path: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { name: 'User', path: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8" },
  { name: 'Users', path: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { name: 'Code', path: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
  { name: 'Terminal', path: Paths.Terminal },
  { name: 'Database', path: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
  { name: 'Server', path: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" },
  { name: 'Chip', path: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" },
  { name: 'Star', path: Paths.Star },
  { name: 'Heart', path: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
  { name: 'Briefcase', path: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9.094-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { name: 'Calendar', path: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { name: 'Clock', path: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { name: 'Cloud', path: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" },
  { name: 'Zap', path: "M13 10V3L4 14h7v7l9-11h-7z" },
  { name: 'Globe', path: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 019-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" },
  { name: 'Book', path: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.247 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { name: 'Academic', path: "M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" },
  { name: 'Image', path: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { name: 'Video', path: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
  { name: 'Music', path: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" },
  { name: 'Pen', path: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" },
  { name: 'Palette', path: "M7 21a4 4 0 01-4-4c0-1.657 1.343-3 3-3h1.332c1.469 0 2.232-1.609 1.465-2.856A6.97 6.97 0 009 9c0-3.866 3.582-7 8-7s8 3.134 8 7c0 3.657-3.414 7-6.535 7-1.125 0-2.126.83-2.43 1.936l-.078.283A4 4 0 0112 21H7z" },
  { name: 'Chat', path: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { name: 'Mail', path: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { name: 'Link', path: Paths.Link },
  { name: 'Gift', path: "M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" },
  { name: 'Cart', path: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" },
  { name: 'Shield', path: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { name: 'Settings', path: Paths.Settings },
];

const CollectionCard = ({ 
  collection, 
  links, 
  isExpanded,
  highlightedItemId,
  onToggleExpand,
  onDelete, 
  onToggleStar, 
  onRemoveLink, 
  onAddFromTab,
  onAddLink,
  onEditLink,
  onExportCSV,
  onDragCollectionStart,
  onDragLinkStart,
  onMoveCollection,
  onMoveLink,
  onMoveLinkToCollection,
  onDropEnd,
  onDropTab
}: CollectionCardProps) => {
  const [linkListRef] = useAutoAnimate();

  const handleOpenAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (links.length === 0) return;
    
    // Check if running in a context where chrome.tabs API is available
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      links.forEach(link => {
        chrome.tabs.create({ url: link.url, active: false });
      });
    } else {
      // Fallback for web preview / non-extension context
      for (const link of links) {
        window.open(link.url, '_blank');
      }
    }
  };

  const isHighlighted = highlightedItemId === collection.id;

  return (
    <div 
      id={collection.id}
      className={`flex flex-col w-full mb-4 pb-4 border-b border-slate-50 last:border-none transition-all duration-700 ${isHighlighted ? 'ring-4 ring-red-400/20 bg-red-50/10 rounded-xl p-4 -mx-4' : ''}`}
      draggable="true"
      onDragStart={() => onDragCollectionStart(collection.id)}
      onDragOver={(e) => { e.preventDefault(); }}
      onDragEnter={(e) => {
        e.stopPropagation();
        onMoveCollection(collection.id);
        onMoveLinkToCollection(collection.id);
      }}
      onDrop={(e) => { e.stopPropagation(); onDropTab(); onDropEnd(); }}
    >
      <div className="flex items-center justify-between mb-2 group h-8">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onToggleExpand}>
          <h3 className={`text-lg font-bold flex items-center gap-2 group-hover:text-red-500 transition-colors ${isHighlighted ? 'text-red-600' : 'text-slate-800'}`}>
            {collection.name}
          </h3>
          <div className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}>
             <Icon path={Paths.ChevronDown} className={`w-3.5 h-3.5 ${isHighlighted ? 'text-red-600' : 'text-red-400'}`} />
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative group/tooltip">
            <button 
              onClick={handleOpenAll}
              className="w-8 h-8 bg-pink-50 hover:bg-pink-100 flex items-center justify-center rounded-lg transition-colors group/btn shadow-sm"
            >
              <Icon path={Paths.OpenAll} className="w-4 h-4 text-pink-500" />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
               <div className="flex flex-col items-center">
                   <div className="bg-pink-500 text-white text-[10px] font-bold px-3 py-1.5 rounded shadow-lg relative">
                       Open tabs
                       <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-pink-500 rotate-45"></div>
                   </div>
               </div>
            </div>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onExportCSV(collection.id); }}
            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-slate-50 rounded-lg transition-colors"
            title="Export CSV"
          >
            <Icon path={Paths.Download} className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center text-slate-200 hover:text-red-500 hover:bg-slate-50 rounded-lg transition-colors"><Icon path={Paths.Trash} className="w-4 h-4" /></button>
          <button className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"><Icon path={Paths.More} className="w-4 h-4" /></button>
        </div>
      </div>
      
      {isExpanded && (
        <div ref={linkListRef} className="grid grid-cols-2 gap-2 transition-all duration-300 min-h-[36px]">
          {links.map(link => {
            const isLinkHighlighted = highlightedItemId === link.id;

            return (
              <div 
                key={link.id} 
                id={link.id}
                draggable={true}
                onDragStart={(e) => { e.stopPropagation(); onDragLinkStart(link.id); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragEnter={(e) => { e.stopPropagation(); onMoveLink(link.id); }}
                onDrop={(e) => { e.stopPropagation(); onDropEnd(); }}
                className={`group relative flex items-center gap-2 p-2 bg-white rounded-xl border shadow-sm transition-all h-[36px] cursor-move ${isLinkHighlighted ? 'border-red-500 ring-2 ring-red-100 shadow-lg' : 'border-slate-100 hover:border-red-100 hover:shadow-md'}`}
              >
                <img src={link.favicon} className="w-4 h-4 rounded flex-shrink-0" onError={e => e.currentTarget.src = 'https://www.google.com/s2/favicons?domain=google.com'} />
                <a href={link.url} target="_blank" className={`flex-1 text-[12px] font-medium truncate hover:text-red-500 leading-tight ${isLinkHighlighted ? 'text-red-600' : 'text-slate-700'}`}>{link.title}</a>
                
                {/* Comment Tooltip on Hover */}
                {link.comment && (
                    <div className="absolute z-[100] left-0 bottom-full mb-1 w-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="bg-slate-800 text-white text-[10px] p-2 rounded-lg shadow-xl border border-slate-700 leading-snug break-words">
                        {link.comment}
                        <div className="absolute left-4 top-full w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-slate-800"></div>
                      </div>
                    </div>
                )}

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditLink(link); }} className="text-slate-200 hover:text-red-500 p-1 transition-colors">
                    <Icon path={Paths.Edit} className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemoveLink(link.id); }} className="text-slate-200 hover:text-red-500 transition-colors p-1">
                    <Icon path={Paths.Trash} className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          
          <div onClick={() => onAddLink(collection.id)} className="p-2 bg-slate-50/40 border border-dashed border-slate-200 rounded-xl text-left text-[12px] text-slate-400 cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-colors h-[36px] flex items-center px-3">New note</div>
        </div>
      )}
    </div>
  );
};

const TableView = ({ links, collections, highlightedItemId, onRemoveLink, onUpdateLink }: TableViewProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ title: string; url: string; comment: string }>({ title: '', url: '', comment: '' });

  const handleEditClick = (link: Link) => {
    setEditingId(link.id);
    setEditData({ title: link.title, url: link.url, comment: link.comment || '' });
  };

  const handleSave = () => {
    if (editingId) {
      onUpdateLink(editingId, editData);
      setEditingId(null);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-left text-sm border-collapse">
        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
          <tr>
            <th className="px-6 py-4 w-12 text-center">Icon</th>
            <th className="px-6 py-4">Page Title</th>
            <th className="px-6 py-4">URL / Address</th>
            <th className="px-6 py-4">Comment</th>
            <th className="px-6 py-4 w-40">Collection</th>
            <th className="px-6 py-4 w-24 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {links.map(link => {
            const isHighlighted = highlightedItemId === link.id;
            const isEditing = editingId === link.id;

            if (isEditing) {
              return (
                <tr key={link.id} className="border-b border-slate-50 bg-slate-50/50">
                   <td className="px-6 py-4 text-center">
                      <img src={link.favicon} className="w-4.5 h-4.5 inline-block" onError={e => e.currentTarget.src = 'https://www.google.com/s2/favicons?domain=google.com'} />
                   </td>
                   <td className="px-6 py-4">
                      <input 
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm text-slate-700 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        value={editData.title}
                        onChange={e => setEditData({...editData, title: e.target.value})}
                        autoFocus
                      />
                   </td>
                   <td className="px-6 py-4">
                      <input 
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-500 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        value={editData.url}
                        onChange={e => setEditData({...editData, url: e.target.value})}
                      />
                   </td>
                   <td className="px-6 py-4">
                      <input 
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-500 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        value={editData.comment}
                        onChange={e => setEditData({...editData, comment: e.target.value})}
                        placeholder="Add a comment..."
                      />
                   </td>
                   <td className="px-6 py-4 text-xs text-slate-400 font-bold">
                      {collections.find(c => c.id === link.collectionId)?.name || 'Default'}
                   </td>
                   <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={handleSave} className="text-green-500 hover:text-green-600 transition-colors bg-white p-1 rounded border border-green-200 shadow-sm"><Icon path={Paths.Check} className="w-3.5 h-3.5" /></button>
                        <button onClick={handleCancel} className="text-slate-400 hover:text-slate-500 transition-colors bg-white p-1 rounded border border-slate-200 shadow-sm"><Icon path={Paths.Close} className="w-3.5 h-3.5" /></button>
                      </div>
                   </td>
                </tr>
              )
            }

            return (
              <tr id={link.id} key={link.id} className={`border-b border-slate-50 group transition-colors ${isHighlighted ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                <td className="px-6 py-4 text-center"><img src={link.favicon} className="w-4.5 h-4.5 inline-block" onError={e => e.currentTarget.src = 'https://www.google.com/s2/favicons?domain=google.com'} /></td>
                <td className="px-6 py-4 cursor-pointer" onClick={() => handleEditClick(link)} title="Click to edit"><span className={`font-medium ${isHighlighted ? 'text-red-700' : 'text-slate-700 hover:text-red-600'}`}>{link.title}</span></td>
                <td className="px-6 py-4 cursor-pointer" onClick={() => handleEditClick(link)} title="Click to edit"><span className="text-slate-400 text-xs truncate block max-w-[200px] hover:text-red-500">{link.url}</span></td>
                <td className="px-6 py-4 cursor-pointer" onClick={() => handleEditClick(link)} title="Click to edit"><span className="text-slate-500 text-xs hover:text-red-500">{link.comment || '-'}</span></td>
                <td className="px-6 py-4 text-xs text-slate-400 font-bold">{collections.find(c => c.id === link.collectionId)?.name || 'Default'}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onRemoveLink(link.id); }} className="text-slate-200 hover:text-red-500 transition-colors"><Icon path={Paths.Trash} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const LinkModal = ({ isOpen, onClose, onSave, initialData, title }: any) => {
  const [formData, setFormData] = useState({ title: '', url: '', comment: '' });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: initialData?.title || '',
        url: initialData?.url || '',
        comment: initialData?.comment || ''
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 border border-slate-100 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{title}</h3>
        
        <div className="space-y-4">
           <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Title</label>
            <input 
              className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="Page title"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">URL</label>
            <input 
              className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs text-slate-500 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              value={formData.url}
              onChange={e => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Comment</label>
            <textarea 
              className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none h-20"
              value={formData.comment}
              onChange={e => setFormData({ ...formData, comment: e.target.value })}
              placeholder="Add a note..."
            />
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <button 
            onClick={onClose}
            className="flex-1 bg-slate-50 text-slate-400 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-95"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const SearchModal = ({ isOpen, onClose, query, setQuery, results, onSelectResult }: any) => {
  const [filter, setFilter] = useState('ALL');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredResults = useMemo(() => {
    let filtered = results;
    if (filter === 'TABS') filtered = results.filter((r: any) => r.type === 'link');
    else if (filter === 'COLLECTIONS') filtered = results.filter((r: any) => r.type === 'collection');
    else if (filter === 'OPEN TABS') filtered = results.filter((r: any) => r.type === 'openTab');
    
    return filtered;
  }, [results, filter]);

  // Reset selection when results change or filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredResults]);

  // Keyboard Navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredResults.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredResults.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredResults.length) % filteredResults.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSelectResult(filteredResults[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredResults, selectedIndex, onSelectResult, onClose]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
        const items = listRef.current.querySelectorAll('.search-item');
        if (items[selectedIndex]) {
            items[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100">
          <Icon path={Paths.Search} className="w-5 h-5 text-slate-400" />
          <input 
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-lg text-slate-800 placeholder:text-slate-300" 
            placeholder="Search within Working Space"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-50 bg-slate-50/50">
          {['ALL', 'TABS', 'COLLECTIONS', 'OPEN TABS'].map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-[10px] font-black tracking-widest uppercase transition-all ${filter === f ? 'bg-red-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar" ref={listRef}>
          {query.trim() === '' ? (
            <div className="px-6 py-12 text-center">
              <p className="text-slate-400 text-sm italic font-medium">Type something to start searching...</p>
            </div>
          ) : filteredResults.length === 0 ? (
             <div className="px-6 py-12 text-center">
              <p className="text-slate-400 text-sm italic font-medium">No matches found for "{query}"</p>
            </div>
          ) : (
            <div className="py-2">
              {filteredResults.map((res: any, idx: number) => (
                <div 
                  key={`${res.type}-${res.id}`} 
                  onClick={() => onSelectResult(res)}
                  className={`search-item w-full flex items-center gap-4 px-6 py-3 text-left transition-colors group cursor-pointer ${idx === selectedIndex ? 'bg-red-50/50' : 'hover:bg-slate-50'}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${idx === selectedIndex ? 'bg-white shadow-md' : 'bg-slate-100 group-hover:bg-white group-hover:shadow-sm'}`}>
                    {res.type === 'link' || res.type === 'openTab' ? (
                      <img src={res.favicon} className="w-5 h-5" onError={e => e.currentTarget.src = 'https://www.google.com/s2/favicons?domain=google.com'} />
                    ) : (
                      <Icon path={Paths.Folder} className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-bold truncate transition-colors ${idx === selectedIndex ? 'text-red-600' : 'text-slate-700'}`}>{res.title}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{res.subtitle}</p>
                  </div>
                  
                  {/* Action Icon: Open External URL */}
                  {(res.type === 'link' || res.type === 'openTab') && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(res.url, '_blank');
                      }}
                      className={`p-2 rounded-lg transition-all ${idx === selectedIndex ? 'text-red-500 bg-white shadow-sm' : 'text-slate-300 hover:text-red-500 hover:bg-white hover:shadow-sm'}`}
                      title="Open in new tab"
                    >
                      <Icon path={Paths.External} className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-50 bg-slate-50/50 flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
           <div className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-sm text-slate-600">↑↓</kbd> SELECT</div>
           <div className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-sm text-slate-600">ENTER</kbd> OPEN</div>
           <div className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-sm text-slate-600">ESC</kbd> CLOSE</div>
        </div>
      </div>
    </div>
  );
};

const SpaceSettingsModal = ({ isOpen, onClose, onSave, space, title }: { isOpen: boolean, onClose: () => void, onSave: (name: string, icon: string) => void, space: Space | null, title?: string }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(Paths.Folder);

  useEffect(() => {
    if (isOpen) {
        if (space) {
          setName(space.name);
          setIcon(space.icon || Paths.Folder);
        } else {
          setName('');
          setIcon(Paths.Folder);
        }
    }
  }, [space, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 border border-slate-100 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{title || "Space Settings"}</h3>
        
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Space Name</label>
          <input 
            className="w-full bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter space name..."
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Select Icon</label>
          <div className="grid grid-cols-6 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
            {AVAILABLE_ICONS.map((ico, idx) => (
              <button 
                key={idx} 
                onClick={() => setIcon(ico.path)} 
                className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${icon === ico.path ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-slate-300 hover:bg-slate-50 hover:text-slate-500 border border-transparent hover:border-slate-100'}`}
                title={ico.name}
              >
                <Icon path={ico.path} className="w-5 h-5" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <button 
            onClick={onClose}
            className="flex-1 bg-slate-50 text-slate-400 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(name, icon)}
            className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-95"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 border border-slate-100 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-2">{title}</h3>
        <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 bg-slate-50 text-slate-400 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-red-500 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-95">Confirm</button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string>('');
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  // Space Settings state
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [isAddSpaceModalOpen, setIsAddSpaceModalOpen] = useState(false);
  const [spaceToDelete, setSpaceToDelete] = useState<string | null>(null);

  // Link Modal state
  const [linkModalState, setLinkModalState] = useState<{ isOpen: boolean, mode: 'add' | 'edit', collectionId: string, linkId?: string, initialData?: any }>({
    isOpen: false,
    mode: 'add',
    collectionId: ''
  });

  // Track expanded state for each collection
  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({});

  const [leftParent] = useAutoAnimate();
  const [rightParent] = useAutoAnimate();
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [isLeftHovering, setIsLeftHovering] = useState(false);
  const [isRightHovering, setIsRightHovering] = useState(false);

  const toggleLeft = () => { setIsLeftCollapsed(!isLeftCollapsed); setIsLeftHovering(false); };
  const toggleRight = () => { setIsRightCollapsed(!isRightCollapsed); setIsRightHovering(false); };
  const isLeftVisible = !isLeftCollapsed || isLeftHovering;
  const isRightVisible = !isRightCollapsed || isRightHovering;
  const isLeftExpandedMode = !isLeftCollapsed || (isLeftCollapsed && isLeftHovering);

  const [draggedCollectionId, setDraggedCollectionId] = useState<string | null>(null);
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null); // State for tracking dragged tabs

  // Handle click outside view menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setIsViewMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setEditingSpaceId(null);
        setLinkModalState(prev => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load Data
  const loadInitialData = async () => {
    const s = await storageService.getSpaces();
    const c = await storageService.getCollections();
    const l = await storageService.getLinks();
    setSpaces(s.length ? s : DEFAULT_SPACES);
    setCollections(c);
    setLinks(l);
    if (s.length) setActiveSpaceId(s[0].id);
    else if (DEFAULT_SPACES.length) setActiveSpaceId(DEFAULT_SPACES[0].id);

    // Initial expanded state
    const initialExpanded: Record<string, boolean> = {};
    c.forEach(col => { initialExpanded[col.id] = true; });
    setExpandedCollections(initialExpanded);

    // Browser Tabs
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({}, (tabs: any[]) => {
        const mappedTabs: OpenTab[] = tabs.map(t => ({
          id: String(t.id),
          windowId: t.windowId!,
          title: t.title || 'Untitled',
          url: t.url || '',
          favicon: t.favIconUrl || 'https://www.google.com/s2/favicons?domain=google.com'
        }));
        setOpenTabs(mappedTabs);
      });
    } else {
      setOpenTabs(MOCK_OPEN_TABS);
    }
  };

  useEffect(() => { loadInitialData(); }, []);

  useEffect(() => { if(spaces.length) storageService.setSpaces(spaces); }, [spaces]);
  useEffect(() => { storageService.setCollections(collections); }, [collections]);
  useEffect(() => { storageService.setLinks(links); }, [links]);

  const activeCollections = useMemo(() => collections.filter(c => c.spaceId === activeSpaceId), [collections, activeSpaceId]);
  const activeLinks = useMemo(() => links.filter(l => activeCollections.some(c => c.id === l.collectionId)), [links, activeCollections]);
  const groupedTabs = useMemo(() => openTabs.reduce((acc, tab) => { acc[tab.windowId] = acc[tab.windowId] || []; acc[tab.windowId].push(tab); return acc; }, {} as Record<number, OpenTab[]>), [openTabs]);

  // Global toggle expand/collapse logic
  const toggleAllInSpace = (expand: boolean) => {
    setExpandedCollections(prev => {
      const updated = { ...prev };
      activeCollections.forEach(c => {
        updated[c.id] = expand;
      });
      return updated;
    });
  };

  const toggleCollectionExpanded = (colId: string) => {
    setExpandedCollections(prev => ({
      ...prev,
      [colId]: !prev[colId]
    }));
  };

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    
    const matchedLinks = links.map(l => ({
      id: l.id,
      title: l.title,
      subtitle: l.url,
      favicon: l.favicon,
      type: 'link',
      collectionId: l.collectionId,
      url: l.url
    })).filter(l => l.title.toLowerCase().includes(q) || l.subtitle.toLowerCase().includes(q));

    const matchedCollections = collections.map(c => ({
      id: c.id,
      title: c.name,
      subtitle: `Collection with ${links.filter(l => l.collectionId === c.id).length} tabs`,
      type: 'collection',
      collectionId: c.id
    })).filter(c => c.title.toLowerCase().includes(q));

    const matchedOpenTabs = openTabs.map(t => ({
      id: t.id,
      title: t.title,
      subtitle: t.url,
      favicon: t.favicon,
      type: 'openTab',
      url: t.url
    })).filter(t => t.title.toLowerCase().includes(q) || t.subtitle.toLowerCase().includes(q));

    return [...matchedCollections, ...matchedLinks, ...matchedOpenTabs];
  }, [searchQuery, links, collections, openTabs]);

  const onSelectSearchResult = (result: any) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    
    if (result.type === 'link' || result.type === 'collection') {
      const colId = result.collectionId;
      const targetCol = collections.find(c => c.id === colId);
      if (targetCol) {
        setActiveSpaceId(targetCol.spaceId);
        setExpandedCollections(prev => ({ ...prev, [colId]: true }));
        
        // Wait for render, then scroll
        setTimeout(() => {
          const element = document.getElementById(result.id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(result.id);
            // Clear highlight after 3 seconds
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 100);
      }
    } else if (result.type === 'openTab') {
       // Just scroll into view in the sidebar if open tabs sidebar is visible
       if (isRightCollapsed) {
          setIsRightHovering(true);
          setTimeout(() => {
             const element = document.getElementById(result.id);
             if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
       } else {
          const element = document.getElementById(result.id);
          if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
       }
    }
  };

  // Backup handlers
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const success = await storageService.importData(content);
      if (success) {
        window.location.reload(); // Refresh to reflect imported data
      } else {
        alert('Failed to import backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleCreateSpace = (name: string, icon: string) => {
    const newSpace: Space = {
      id: `space-${Date.now()}`,
      name: name.trim() || 'New Space',
      icon: icon || Paths.Folder
    };
    setSpaces([...spaces, newSpace]);
    setActiveSpaceId(newSpace.id);
    setIsAddSpaceModalOpen(false);
  };

  const requestDeleteSpace = (id: string) => {
    if (spaces.length <= 1) {
      alert("You must have at least one space.");
      return;
    }
    setSpaceToDelete(id);
  };

  const confirmDeleteSpace = () => {
    if (!spaceToDelete) return;
    const id = spaceToDelete;
    
    const remainingSpaces = spaces.filter(s => s.id !== id);
    setSpaces(remainingSpaces);
    if (activeSpaceId === id) {
       setActiveSpaceId(remainingSpaces.length ? remainingSpaces[0].id : '');
    }
    // collections/links cleanup
    const colsInSpace = collections.filter(c => c.spaceId === id);
    const colIds = colsInSpace.map(c => c.id);
    setCollections(collections.filter(c => c.spaceId !== id));
    setLinks(links.filter(l => !colIds.includes(l.collectionId)));
    
    setSpaceToDelete(null);
  };

  const addCollection = (name?: string) => {
    let collectionName = name;
    if (!collectionName) {
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      collectionName = `${yy}.${mm}.${dd}.${hh}:${min}`;
    }

    const id = `col-${Date.now()}`;
    setCollections([{ id, spaceId: activeSpaceId, name: collectionName!, isStarred: false, timestamp: Date.now() }, ...collections]);
    setExpandedCollections(prev => ({ ...prev, [id]: true }));
    return id;
  };

  const deleteCollection = (id: string) => {
    setCollections(collections.filter(c => c.id !== id));
    setLinks(links.filter(l => l.collectionId !== id));
  };

  const addTabToCollection = (tab: OpenTab, colId: string) => {
    const newLink: Link = { id: `link-${Date.now()}-${Math.random()}`, collectionId: colId, title: tab.title, url: tab.url, favicon: tab.favicon, timestamp: Date.now() };
    setLinks([...links, newLink]);
    setOpenTabs(openTabs.filter(t => t.id !== tab.id));
  };

  const manualAddLink = (colId: string, title: string, url: string, comment?: string) => {
    const newLink: Link = { 
      id: `link-${Date.now()}-${Math.random()}`, 
      collectionId: colId, 
      title: title, 
      url: url.startsWith('http') ? url : `https://${url}`, 
      favicon: `https://www.google.com/s2/favicons?domain=${url}`, 
      comment,
      timestamp: Date.now() 
    };
    setLinks([...links, newLink]);
  };

  const handleLinkUpdate = (id: string, data: { title: string, url: string, comment: string }) => {
    setLinks(prev => prev.map(l => l.id === id ? { 
      ...l, 
      ...data,
      // Update favicon if URL changed (simple check or always update)
      favicon: l.url !== data.url ? `https://www.google.com/s2/favicons?domain=${data.url}` : l.favicon
    } : l));
  };

  const saveWindowAsSession = (windowId: number) => {
    const tabsToSave = groupedTabs[windowId];
    if (!tabsToSave.length) return;

    // Use default timestamp naming from addCollection
    const colId = addCollection();

    const newLinks = tabsToSave.map((t, i) => ({
      id: `link-${Date.now()}-${i}`,
      collectionId: colId,
      title: t.title,
      url: t.url,
      favicon: t.favicon,
      timestamp: Date.now()
    }));
    setLinks([...links, ...newLinks]);
    setOpenTabs(openTabs.filter(t => t.windowId !== windowId));
  };
  
  const updateSpace = (spaceId: string, name: string, iconPath: string) => {
    setSpaces(spaces.map(s => s.id === spaceId ? { ...s, name, icon: iconPath } : s));
    setEditingSpaceId(null);
  };

  // --- Link Modal Logic ---
  const openAddLinkModal = (collectionId: string) => {
    setLinkModalState({ 
      isOpen: true, 
      mode: 'add', 
      collectionId, 
      initialData: { title: '', url: '', comment: '' } 
    });
  }

  const openEditLinkModal = (link: Link) => {
    setLinkModalState({
      isOpen: true,
      mode: 'edit',
      collectionId: link.collectionId,
      linkId: link.id,
      initialData: { title: link.title, url: link.url, comment: link.comment }
    });
  }

  const handleLinkSave = (data: { title: string, url: string, comment: string }) => {
    if (linkModalState.mode === 'add') {
       manualAddLink(linkModalState.collectionId, data.title, data.url, data.comment);
    } else {
       if (linkModalState.linkId) {
          setLinks(links.map(l => l.id === linkModalState.linkId ? { ...l, ...data } : l));
       }
    }
    setLinkModalState({ ...linkModalState, isOpen: false });
  }

  // --- Real-time Drag & Sort Logic ---
  const handleDragCollectionStart = (id: string) => { setDraggedCollectionId(id); setDraggedLinkId(null); setDraggedTabId(null); };
  const handleDragLinkStart = (id: string) => { setDraggedLinkId(id); setDraggedCollectionId(null); setDraggedTabId(null); };
  const handleDragTabStart = (id: string) => { setDraggedTabId(id); setDraggedCollectionId(null); setDraggedLinkId(null); }; // New handler for tab dragging

  const moveCollection = (targetId: string) => {
    if (!draggedCollectionId || draggedCollectionId === targetId) return;
    setCollections(prev => {
      const draggedIdx = prev.findIndex(c => c.id === draggedCollectionId);
      const targetIdx = prev.findIndex(c => c.id === targetId);
      if (draggedIdx === -1 || targetIdx === -1 || draggedIdx === targetIdx) return prev;
      const newCols = [...prev];
      const [moved] = newCols.splice(draggedIdx, 1);
      newCols.splice(targetIdx, 0, moved);
      return newCols;
    });
  };

  const moveLink = (targetLinkId: string) => {
    if (!draggedLinkId || draggedLinkId === targetLinkId) return;
    setLinks(prev => {
      const draggedIdx = prev.findIndex(l => l.id === draggedLinkId);
      const targetIdx = prev.findIndex(l => l.id === targetLinkId);
      if (draggedIdx === -1 || targetIdx === -1) return prev;
      const draggedLink = prev[draggedIdx];
      const targetLink = prev[targetIdx];
      if (draggedLink.collectionId !== targetLink.collectionId) {
         const newLinks = [...prev];
         const [moved] = newLinks.splice(draggedIdx, 1);
         moved.collectionId = targetLink.collectionId;
         const newTargetIdx = newLinks.findIndex(l => l.id === targetLinkId);
         newLinks.splice(newTargetIdx, 0, moved);
         return newLinks;
      } else {
        if (draggedIdx === targetIdx) return prev;
        const newLinks = [...prev];
        const [moved] = newLinks.splice(draggedIdx, 1);
        newLinks.splice(targetIdx, 0, moved);
        return newLinks;
      }
    });
  };

  const moveLinkToCollection = (targetCollectionId: string) => {
    if (!draggedLinkId) return;
    setLinks(prev => {
      const draggedLink = prev.find(l => l.id === draggedLinkId);
      if (!draggedLink || draggedLink.collectionId === targetCollectionId) return prev;
      return prev.map(l => l.id === draggedLinkId ? { ...l, collectionId: targetCollectionId } : l);
    });
  };

  const handleTabDropOnCollection = (collectionId: string) => {
    if (draggedTabId) {
      const tab = openTabs.find(t => t.id === draggedTabId);
      if (tab) {
        addTabToCollection(tab, collectionId);
      }
    }
  };

  const handleExportCSV = (collectionId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;

    const collectionLinks = links.filter(l => l.collectionId === collectionId);
    
    // Create CSV content
    const headers = ['Title', 'URL', 'Comment', 'Created At'];
    const rows = collectionLinks.map(link => {
      const escape = (text: string) => `"${(text || '').replace(/"/g, '""')}"`;
      return [
        escape(link.title),
        escape(link.url),
        escape(link.comment || ''),
        escape(new Date(link.timestamp).toLocaleString())
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${collection.name.replace(/[^a-z0-9\-_]/gi, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDropEnd = () => { setDraggedCollectionId(null); setDraggedLinkId(null); setDraggedTabId(null); };

  // Grid Split Columns
  const leftColCollections = activeCollections.filter((_, i) => i % 2 === 0);
  const rightColCollections = activeCollections.filter((_, i) => i % 2 !== 0);

  return (
    <div className="flex h-screen bg-[#f8f9fc] text-slate-800 overflow-hidden font-sans select-none">
      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
      
      <SpaceSettingsModal 
        isOpen={!!editingSpaceId} 
        onClose={() => setEditingSpaceId(null)}
        onSave={(name, icon) => editingSpaceId && updateSpace(editingSpaceId, name, icon)}
        space={spaces.find(s => s.id === editingSpaceId) || null}
      />

      <SpaceSettingsModal 
        isOpen={isAddSpaceModalOpen}
        onClose={() => setIsAddSpaceModalOpen(false)}
        onSave={handleCreateSpace}
        space={null}
        title="Create New Space"
      />

      <LinkModal 
        isOpen={linkModalState.isOpen}
        onClose={() => setLinkModalState(prev => ({ ...prev, isOpen: false }))}
        onSave={handleLinkSave}
        initialData={linkModalState.initialData}
        title={linkModalState.mode === 'add' ? 'Add New Link' : 'Edit Link'}
      />

      <ConfirmModal 
        isOpen={!!spaceToDelete}
        onClose={() => setSpaceToDelete(null)}
        onConfirm={confirmDeleteSpace}
        title="Delete Space?"
        message="This will permanently delete this space and all its collections. This action cannot be undone."
      />
      
      <SearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)}
        query={searchQuery}
        setQuery={setSearchQuery}
        results={searchResults}
        onSelectResult={onSelectSearchResult}
      />

      {/* LEFT SIDEBAR: Working Space */}
      <div 
        className={`relative flex-col h-full flex-shrink-0 transition-all duration-300 ease-in-out z-50 ${isLeftCollapsed ? 'w-16' : 'w-52'}`}
        onMouseEnter={() => isLeftCollapsed && setIsLeftHovering(true)}
        onMouseLeave={() => isLeftCollapsed && setIsLeftHovering(false)}
      >
        <aside className={`h-full bg-white shadow-2xl overflow-hidden flex flex-col border-r border-slate-100 transition-all duration-300 ease-in-out ${isLeftCollapsed && isLeftHovering ? 'absolute left-0 top-0 w-52 z-50' : 'w-full'}`}>
          <div className={`flex items-center px-4 py-3 shrink-0 border-b border-slate-50 ${isLeftExpandedMode ? 'justify-between' : 'justify-center'} min-h-[52px]`}>
             {/* ADD SPACE BUTTON */}
             {isLeftExpandedMode && (
                <button 
                  onClick={() => setIsAddSpaceModalOpen(true)}
                  className="bg-red-500 text-white w-7 h-7 flex items-center justify-center rounded-md shadow-md hover:bg-red-600 transition-all active:scale-95 group"
                  title="Add New Space"
                >
                  <Icon path={Paths.Plus} className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </button>
             )}

             <button onClick={toggleLeft} className={`p-1 text-slate-300 hover:text-red-500 hover:bg-slate-50 rounded-md transition-all ${isLeftCollapsed ? 'rotate-180' : ''}`} title={isLeftCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
               <Icon path={Paths.SidebarLeft} className="w-4 h-4" />
             </button>
          </div>

          <nav className={`flex-1 overflow-y-auto custom-scrollbar p-2 ${!isLeftExpandedMode ? 'flex flex-col items-center mt-6' : ''}`}>
            <div className="w-full">
              <div className="space-y-0.5 w-full">
                {spaces.map(s => (
                  <div key={s.id} className="relative group/item w-full" onContextMenu={(e) => { e.preventDefault(); setEditingSpaceId(s.id); }}>
                      <button onClick={() => setActiveSpaceId(s.id)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-bold transition-all ${activeSpaceId === s.id ? 'bg-red-50 text-red-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'} ${!isLeftExpandedMode ? 'justify-center px-0' : ''}`} title={s.name}>
                        <Icon path={s.icon || Paths.Folder} className={`shrink-0 w-3.5 h-3.5 ${activeSpaceId === s.id ? 'text-red-500' : 'text-slate-200'}`} />
                        {isLeftExpandedMode && <span className="truncate">{s.name}</span>}
                      </button>
                      {isLeftExpandedMode && (
                         <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 flex items-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); setEditingSpaceId(s.id); }} className="text-red-500 hover:text-red-600 p-1.5 bg-red-50 border border-red-200 rounded-md shadow-sm transition-all" title="Edit Space"><Icon path={Paths.Edit} className="w-3.5 h-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); requestDeleteSpace(s.id); }} className="text-slate-400 hover:text-red-500 p-1.5 bg-slate-50 border border-slate-100 rounded-md shadow-sm transition-all" title="Delete Space"><Icon path={Paths.Trash} className="w-3.5 h-3.5" /></button>
                         </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          </nav>
          
          <div className={`p-2 border-t border-slate-50 mt-auto ${!isLeftExpandedMode ? 'flex flex-col items-center' : ''}`}>
             {isLeftExpandedMode && (
                <div className="px-3 py-2 mb-1">
                  <h3 className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Settings</h3>
                </div>
             )}
             <button onClick={() => fileInputRef.current?.click()} className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-400 hover:bg-slate-50 hover:text-red-500 rounded-lg group transition-all ${!isLeftExpandedMode ? 'justify-center px-0' : ''}`} title="Import Collections">
               <Icon path={Paths.Upload} className="text-slate-300 shrink-0 group-hover:text-red-500 w-3.5 h-3.5" />
               {isLeftExpandedMode && <span className="truncate">Import</span>}
             </button>
             <button onClick={() => storageService.exportAllData()} className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-400 hover:bg-slate-50 hover:text-red-500 rounded-lg group transition-all ${!isLeftExpandedMode ? 'justify-center px-0' : ''}`} title="Export Collections">
               <Icon path={Paths.Download} className="text-slate-300 shrink-0 group-hover:text-red-500 w-3.5 h-3.5" />
               {isLeftExpandedMode && <span className="truncate">Export</span>}
             </button>
          </div>
        </aside>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-white relative z-10 shadow-2xl">
        <header className="px-8 py-4 border-b border-slate-50 flex items-center bg-white shrink-0">
          <div className="flex items-center gap-3 shrink-0">
             {isLeftCollapsed && !isLeftHovering && (
              <button onClick={toggleLeft} className="p-1.5 text-slate-200 hover:text-red-500 hover:bg-slate-50 rounded-md transition-all rotate-180"><Icon path={Paths.SidebarLeft} className="w-3.5 h-3.5" /></button>
            )}
            <h2 className="text-lg font-black text-slate-700 tracking-tight whitespace-nowrap">{spaces.find(s => s.id === activeSpaceId)?.name}</h2>
            <span className="text-slate-200 text-sm font-light">|</span>
            <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap">{activeCollections.length} collections</span>
          </div>
          
          <div className="flex-1 flex justify-start ml-8">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="w-full max-w-[240px] bg-white border border-blue-600 rounded-md px-3 py-1.5 flex items-center justify-between group hover:shadow-sm transition-all h-9"
              title="Search (⌘K)"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Icon path={Paths.Search} className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 shrink-0" />
                <span className="text-[11px] font-bold text-slate-300 truncate uppercase tracking-widest">SEARCH...</span>
              </div>
              <kbd className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-[8px] text-slate-400 font-mono shadow-sm">⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-5 shrink-0 ml-auto">
            <button className="p-1.5 text-slate-200 hover:text-slate-600 transition-colors"><Icon path={Paths.Settings} className="w-4.5 h-4.5" /></button>
            {isRightCollapsed && (
              <button onClick={toggleRight} className="p-1.5 text-slate-200 hover:text-red-500 hover:bg-slate-50 rounded-md transition-all rotate-180"><Icon path={Paths.SidebarRight} className="w-3.5 h-3.5" /></button>
            )}
          </div>
        </header>

        {/* Action Bar */}
        <div className="px-8 py-2 bg-[#fdfdfd] border-b border-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => addCollection()} className="bg-red-500 text-white px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-red-600 transition-all flex items-center gap-2">
               <Icon path={Paths.Plus} className="w-3.5 h-3.5" />
               <span>Collection</span>
            </button>
            
            <div className="relative ml-2" ref={viewMenuRef}>
              <button onClick={() => setIsViewMenuOpen(!isViewMenuOpen)} className="text-[9px] font-black uppercase tracking-widest text-red-500 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                {viewMode === 'grid' ? <Icon path={Paths.Grid} className="w-3 h-3" /> : <Icon path={Paths.Table} className="w-3 h-3" />} 
                View <Icon path={Paths.ChevronDown} className="w-2.5 h-2.5" />
              </button>
              {isViewMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-44 bg-white border border-slate-100 rounded-xl shadow-2xl z-[100] py-1">
                  <button onClick={() => {setViewMode('grid'); setIsViewMenuOpen(false)}} className="w-full px-4 py-2 text-left text-[11px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 flex items-center gap-3"><Icon path={Paths.Grid} className="w-4 h-4 text-slate-300" /> Grid View</button>
                  <button onClick={() => {setViewMode('table'); setIsViewMenuOpen(false)}} className="w-full px-4 py-2 text-left text-[11px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 flex items-center gap-3"><Icon path={Paths.Table} className="w-4 h-4 text-slate-300" /> Table</button>
                </div>
              )}
            </div>
            <button 
              onClick={() => toggleAllInSpace(true)} 
              className="text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-red-500 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-slate-50"
            >
              Expand
            </button>
            <button 
              onClick={() => toggleAllInSpace(false)} 
              className="text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-red-500 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-slate-50"
            >
              Collapse
            </button>
          </div>
        </div>

        {/* Dynamic Canvas */}
        <div className="flex-1 overflow-hidden bg-white">
          {viewMode === 'grid' ? (
            <div className="flex h-full w-full">
              {/* LEFT INDEPENDENT COLUMN */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 border-r border-slate-50">
                <div ref={leftParent} className="max-w-[600px] ml-auto w-full">
                  {leftColCollections.map(col => (
                    <CollectionCard 
                      key={col.id} 
                      collection={col} 
                      links={links.filter(l => l.collectionId === col.id)} 
                      isExpanded={expandedCollections[col.id] ?? true}
                      highlightedItemId={highlightedItemId}
                      onToggleExpand={() => toggleCollectionExpanded(col.id)}
                      onDelete={() => deleteCollection(col.id)} 
                      onToggleStar={() => {}} 
                      onRemoveLink={id => setLinks(links.filter(l => l.id !== id))} 
                      onAddFromTab={tab => addTabToCollection(tab, col.id)}
                      onAddLink={openAddLinkModal}
                      onEditLink={openEditLinkModal}
                      onExportCSV={handleExportCSV}
                      onDragCollectionStart={handleDragCollectionStart}
                      onDragLinkStart={handleDragLinkStart}
                      onMoveCollection={moveCollection}
                      onMoveLink={moveLink}
                      onMoveLinkToCollection={moveLinkToCollection}
                      onDropEnd={handleDropEnd}
                      onDropTab={() => handleTabDropOnCollection(col.id)}
                    />
                  ))}
                </div>
              </div>
              
              {/* RIGHT INDEPENDENT COLUMN */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                <div ref={rightParent} className="max-w-[600px] mr-auto w-full">
                  {rightColCollections.map(col => (
                    <CollectionCard 
                      key={col.id} 
                      collection={col} 
                      links={links.filter(l => l.collectionId === col.id)} 
                      isExpanded={expandedCollections[col.id] ?? true}
                      highlightedItemId={highlightedItemId}
                      onToggleExpand={() => toggleCollectionExpanded(col.id)}
                      onDelete={() => deleteCollection(col.id)} 
                      onToggleStar={() => {}} 
                      onRemoveLink={id => setLinks(links.filter(l => l.id !== id))} 
                      onAddFromTab={tab => addTabToCollection(tab, col.id)}
                      onAddLink={openAddLinkModal}
                      onEditLink={openEditLinkModal}
                      onExportCSV={handleExportCSV}
                      onDragCollectionStart={handleDragCollectionStart}
                      onDragLinkStart={handleDragLinkStart}
                      onMoveCollection={moveCollection}
                      onMoveLink={moveLink}
                      onMoveLinkToCollection={moveLinkToCollection}
                      onDropEnd={handleDropEnd}
                      onDropTab={() => handleTabDropOnCollection(col.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-12 custom-scrollbar">
              <div className="max-w-7xl mx-auto">
                <TableView 
                  links={activeLinks} 
                  collections={collections} 
                  highlightedItemId={highlightedItemId}
                  onRemoveLink={id => setLinks(links.filter(l => l.id !== id))} 
                  onUpdateLink={handleLinkUpdate}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* SENSING TRIGGER RIGHT */}
      {isRightCollapsed && (<div className="absolute right-0 top-0 bottom-0 w-4 z-[60] hover:bg-red-500/0" onMouseEnter={() => setIsRightHovering(true)} />)}

      {/* RIGHT SIDEBAR: Open Tabs - COMPACT UI OPTIMIZATION */}
      <aside 
        className={`bg-white shadow-2xl overflow-hidden flex flex-col border-l border-slate-100 transition-all duration-300 ease-in-out ${!isRightCollapsed ? 'relative w-56' : 'absolute right-0 h-full z-50'} ${isRightCollapsed && isRightHovering ? 'w-56' : (isRightCollapsed ? 'w-0' : '')}`}
        onMouseLeave={() => isRightCollapsed && setIsRightHovering(false)}
      >
        <div className={`flex flex-col h-full transition-opacity duration-200 ${isRightVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b border-slate-50/50">
             <div className="flex items-center gap-1.5">
               <button onClick={toggleRight} className={`p-0.5 text-slate-300 hover:text-red-500 transition-all ${isRightCollapsed ? 'rotate-180' : ''}`}><Icon path={Paths.SidebarRight} className="w-3 h-3" /></button>
               <h2 className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-300">Open Tabs</h2>
             </div>
             <Icon path={Paths.Settings} className="w-3 h-3 text-slate-200 hover:text-slate-400 cursor-pointer transition-colors" />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 pt-3 space-y-4">
            {Object.entries(groupedTabs).map(([winId, tabs]) => (
              <div key={winId} className="space-y-1.5">
                <div className="flex items-center justify-between px-1 group/header">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[9px] font-black uppercase tracking-tight text-slate-300">Window {winId}</h3>
                    <span className="text-[9px] font-black text-slate-200">[{tabs.length}]</span>
                  </div>
                  <button 
                    onClick={() => saveWindowAsSession(Number(winId))}
                    className="p-0.5 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover/header:opacity-100"
                    title="Save Session"
                  >
                    <Icon path={Paths.Save} className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {tabs.map(tab => (
                    <div 
                      id={tab.id} 
                      key={tab.id} 
                      className="group relative bg-white p-1.5 rounded-lg border border-slate-50/50 shadow-sm hover:border-red-100/50 hover:shadow-md transition-all cursor-pointer"
                      draggable="true"
                      onDragStart={() => handleDragTabStart(tab.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-slate-50 rounded-md flex items-center justify-center shrink-0 group-hover:bg-red-50/50 transition-colors overflow-hidden">
                           <img src={tab.favicon} className="w-4.5 h-4.5 object-contain" onError={e => e.currentTarget.src = 'https://www.google.com/s2/favicons?domain=google.com&sz=64'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-slate-700 truncate leading-tight group-hover:text-red-600 transition-colors">{tab.title}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => activeCollections.length ? addTabToCollection(tab, activeCollections[0].id) : addTabToCollection(tab, addCollection())} 
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 p-1 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-md transition-all"
                      >
                        <Icon path={Paths.ArrowLeft} className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!openTabs.length && <div className="text-center py-6 text-slate-200 italic text-[9px] font-medium">No open tabs</div>}
          </div>

          <div className="mt-2 pt-3 px-3 pb-4 border-t border-slate-50/50 shrink-0">
            <button onClick={() => saveWindowAsSession(1)} className="w-full bg-[#0f172a] text-white py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-slate-900/10 hover:bg-black transition-all active:scale-[0.98]">Save Collection</button>
          </div>
        </div>
      </aside>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}