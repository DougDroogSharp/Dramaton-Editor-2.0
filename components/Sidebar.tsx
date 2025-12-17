import React, { useState, useRef, useEffect } from 'react';
import { Plus, Settings, User, Monitor, Package, Music, Video, ChevronDown, Save, FolderOpen, Volume2, VolumeX, Undo2, Play, Square, HardDrive } from 'lucide-react';
import { GameData, SelectionState, GameInfo } from '../types';
import { DramatonLogo } from './DramatonLogo';

interface SidebarProps {
  game: GameData;
  selection: SelectionState;
  onSelect: (type: SelectionState['type'], id: string | null, subId?: string) => void;
  onAddActor: () => void;
  onAddScene: () => void;
  onAddDrop: () => void;
  onAddItem: () => void;
  onAddSfx: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  isRestPeriod: boolean;
  autoSaveError?: boolean;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onRunGame: () => void;
  isSimulating: boolean;
  onStopGame: () => void;
  onUpdateInfo: (field: keyof GameInfo, value: any) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  game, 
  selection, 
  onSelect, 
  onAddActor, 
  onAddScene, 
  onAddDrop,
  onAddItem,
  onAddSfx,
  onSave,
  onLoad,
  isRestPeriod,
  autoSaveError,
  voiceEnabled,
  onToggleVoice,
  onUndo,
  canUndo,
  onRunGame,
  isSimulating,
  onStopGame,
  onUpdateInfo
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [lastActiveSceneId, setLastActiveSceneId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
           setActiveMenu(null);
        }
     };
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hotkeys for Menus (Alt + Key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        const key = e.key.toLowerCase();
        // Prevent default browser menu activation when possible
        
        switch(key) {
            case 'a': // Actor
                e.preventDefault();
                setActiveMenu(prev => prev === 'actors' ? null : 'actors');
                break;
            case 's': // Scenes
                e.preventDefault();
                setActiveMenu(prev => prev === 'scenes' ? null : 'scenes');
                break;
            case 'd': // Drops (Alt-D)
                e.preventDefault();
                setActiveMenu(prev => prev === 'drops' ? null : 'drops');
                break;
            case 'i': // Items
                e.preventDefault();
                setActiveMenu(prev => prev === 'items' ? null : 'items');
                break;
            case 'x': // SFX
                e.preventDefault();
                setActiveMenu(prev => prev === 'sfx' ? null : 'sfx');
                break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (selection.type === 'scene' && selection.id) {
      setLastActiveSceneId(selection.id);
    }
  }, [selection]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoad(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isSelected = (type: SelectionState['type'], id: string | null = null) => {
    return selection.type === type && selection.id === id;
  };

  const toggleMenu = (menuName: string) => {
     setActiveMenu(prev => prev === menuName ? null : menuName);
  };

  // Dropdown Component
  const DropdownMenu: React.FC<{ label: string, name: string, icon: any, color: string, children: React.ReactNode }> = ({ label, name, icon: Icon, color, children }) => (
     <div className="relative">
        <button 
           onClick={() => toggleMenu(name)}
           className={`
              h-10 px-1.5 md:px-3 flex items-center gap-1 text-[10px] md:text-xs font-bold tracking-widest uppercase transition-colors border-r border-diesel-border
              ${activeMenu === name ? `bg-diesel-panel ${color}` : 'text-diesel-steel hover:text-white hover:bg-white/5'}
           `}
        >
           <Icon size={14} className={activeMenu === name ? color : 'text-diesel-steel'} />
           <span>{label}</span>
           <ChevronDown size={10} className={`opacity-50 transition-transform ${activeMenu === name ? 'rotate-180' : ''}`} />
        </button>
        
        {activeMenu === name && (
           <div className="absolute top-full left-0 min-w-[200px] max-h-[70vh] overflow-y-auto bg-diesel-panel border border-diesel-gold shadow-diesel-glow z-[100] animate-fade-in flex flex-col">
              {children}
           </div>
        )}
     </div>
  );

  const DropdownItem: React.FC<{ onClick: () => void, active?: boolean, label: string, subLabel?: string }> = ({ onClick, active, label, subLabel }) => (
      <button 
         onClick={() => { onClick(); setActiveMenu(null); }}
         className={`
            w-full text-left px-4 py-3 border-b border-diesel-border/50 text-xs font-mono transition-colors flex flex-col
            ${active ? 'bg-diesel-gold text-black font-bold' : 'text-diesel-paper hover:bg-white/10 hover:text-white'}
         `}
      >
         <span className="truncate w-full block">{label}</span>
         {subLabel && <span className={`text-[9px] truncate w-full block mt-0.5 ${active ? 'text-black/70' : 'text-diesel-steel'}`}>{subLabel}</span>}
      </button>
  );

  const CreateButton: React.FC<{ onClick: () => void, label: string, color: string }> = ({ onClick, label, color }) => (
     <button 
        onClick={() => { onClick(); setActiveMenu(null); }}
        className={`w-full text-left px-4 py-3 bg-black/50 hover:bg-white hover:text-black border-b border-diesel-border flex items-center gap-2 text-xs font-bold uppercase transition-colors ${color}`}
     >
        <Plus size={14} /> {label}
     </button>
  );

  const sortedScenes = [...game.scenes].sort((a, b) => {
    if (a.id === lastActiveSceneId) return -1;
    if (b.id === lastActiveSceneId) return 1;
    return 0;
  });

  return (
    <div ref={menuRef} className="w-full h-10 bg-diesel-black border-b border-diesel-border flex items-center justify-between shrink-0 relative z-50 select-none">
      
      {/* LEFT: Branding & Menus */}
      <div className="flex items-center h-full">
         
         {/* Logo Block - Compact on Mobile */}
         <div className="flex items-center gap-2 px-3 h-full bg-diesel-dark border-r border-diesel-border">
             <DramatonLogo className="w-6 h-6 text-diesel-rust" />
             <div className="flex-col hidden md:flex">
               <span className="text-xs font-bold text-diesel-paper leading-none font-sans tracking-tight">DRAMATON</span>
               <span className="text-[10px] text-diesel-gold font-mono leading-none">v2.5</span>
             </div>
         </div>

         {/* MAIN CONTROL BUTTONS */}
         <button 
            onClick={() => onSelect('settings', null)}
            className={`h-10 px-2 md:px-3 flex items-center gap-2 text-xs font-bold tracking-widest uppercase transition-colors border-r border-diesel-border ${isSelected('settings') ? 'bg-diesel-panel text-diesel-gold' : 'text-diesel-steel hover:text-white hover:bg-white/5'}`}
            title="Game Settings"
         >
            <Settings size={14} />
         </button>

         <button 
            onClick={() => fileInputRef.current?.click()}
            className="h-10 px-2 md:px-3 flex items-center gap-2 text-xs font-bold tracking-widest uppercase transition-colors border-r border-diesel-border text-diesel-steel hover:text-white hover:bg-white/5"
            title="Load Protocol"
         >
            <FolderOpen size={14} />
         </button>
         <input type="file" ref={fileInputRef} className="hidden" accept=".dram" onChange={handleFileChange} />

         <button 
            onClick={onSave}
            className="h-10 px-2 md:px-3 flex items-center gap-2 text-xs font-bold tracking-widest uppercase transition-colors border-r border-diesel-border text-diesel-steel hover:text-white hover:bg-white/5"
            title="Save Protocol"
         >
            <Save size={14} />
         </button>

         {/* MENUS - Short Names with Hotkeys */}
         <DropdownMenu label="Ac (A)" name="actors" icon={User} color="text-diesel-gold">
             <CreateButton onClick={onAddActor} label="New Actor" color="text-diesel-gold" />
             {game.actors.map(actor => (
                <DropdownItem 
                   key={actor.id} 
                   onClick={() => onSelect('actor', actor.id)} 
                   label={actor.name} 
                   subLabel={`ID: ${actor.id.substring(0,6)}`}
                   active={isSelected('actor', actor.id)} 
                />
             ))}
             {game.actors.length === 0 && <div className="p-4 text-[10px] text-diesel-steel italic">No Actors</div>}
         </DropdownMenu>

         <DropdownMenu label="Sc (S)" name="scenes" icon={Video} color="text-diesel-rust">
             <CreateButton onClick={onAddScene} label="New Scene" color="text-diesel-rust" />
             {sortedScenes.map(scene => (
                <DropdownItem 
                   key={scene.id} 
                   onClick={() => onSelect('scene', scene.id)} 
                   label={scene.name} 
                   subLabel={scene.dropId ? "Has Drop" : "No Drop"}
                   active={isSelected('scene', scene.id)} 
                />
             ))}
              {game.scenes.length === 0 && <div className="p-4 text-[10px] text-diesel-steel italic">No Scenes</div>}
         </DropdownMenu>

         <DropdownMenu label="Dr (D)" name="drops" icon={Monitor} color="text-diesel-paper">
             <CreateButton onClick={onAddDrop} label="New Drop" color="text-diesel-paper" />
             {game.drops.map(drop => (
                <DropdownItem 
                   key={drop.id} 
                   onClick={() => onSelect('drop', drop.id)} 
                   label={drop.name} 
                   subLabel={drop.image ? "Visual Ready" : "Prompt Only"}
                   active={isSelected('drop', drop.id)} 
                />
             ))}
              {game.drops.length === 0 && <div className="p-4 text-[10px] text-diesel-steel italic">No Drops</div>}
         </DropdownMenu>

         <DropdownMenu label="It (I)" name="items" icon={Package} color="text-diesel-gold">
             <CreateButton onClick={onAddItem} label="New Item" color="text-diesel-gold" />
             {game.items.map(item => (
                <DropdownItem 
                   key={item.id} 
                   onClick={() => onSelect('item', item.id)} 
                   label={item.name} 
                   subLabel={item.category.toUpperCase()}
                   active={isSelected('item', item.id)} 
                />
             ))}
              {game.items.length === 0 && <div className="p-4 text-[10px] text-diesel-steel italic">No Items</div>}
         </DropdownMenu>
         
         <DropdownMenu label="SFX (X)" name="sfx" icon={Music} color="text-diesel-green">
             <CreateButton onClick={onAddSfx} label="New Effect" color="text-diesel-green" />
             {game.sfx.map(sfx => (
                <DropdownItem 
                   key={sfx.id} 
                   onClick={() => onSelect('sfx', sfx.id)} 
                   label={sfx.name} 
                   subLabel={sfx.type.toUpperCase()}
                   active={isSelected('sfx', sfx.id)} 
                />
             ))}
              {game.sfx.length === 0 && <div className="p-4 text-[10px] text-diesel-steel italic">No Effects</div>}
         </DropdownMenu>

      </div>

      {/* RIGHT: Tools & Status */}
      <div className="flex items-center h-full bg-diesel-dark border-l border-diesel-border px-1 md:px-2 gap-1 md:gap-2">
         
         {/* Autosave Status (Mode Toggle) */}
         <button 
            onClick={() => onUpdateInfo('enableAutosave', !game.info.enableAutosave)}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${game.info.enableAutosave ? 'text-diesel-green bg-diesel-green/10 hover:bg-diesel-green/20' : 'text-diesel-steel opacity-50 hover:opacity-100 hover:bg-white/10'}`}
            title={game.info.enableAutosave ? "Autosave ON (Click to Disable)" : "Autosave OFF (Click to Enable)"}
         >
            <div className={`w-1.5 h-1.5 rounded-full ${game.info.enableAutosave ? 'bg-diesel-green animate-pulse' : 'bg-diesel-steel'}`}></div>
            <span className="hidden md:inline text-[9px] font-bold tracking-widest uppercase">
               {isRestPeriod ? 'LOCKED' : (game.info.enableAutosave ? 'AUTO' : 'MANUAL')}
            </span>
         </button>

         <div className="h-4 w-px bg-diesel-border mx-0.5"></div>

         <button 
           onClick={onUndo} 
           disabled={!canUndo}
           className={`p-1.5 rounded hover:bg-white/10 transition-colors ${canUndo ? 'text-diesel-paper' : 'text-diesel-steel opacity-30 cursor-not-allowed'}`}
           title="Undo"
         >
            <Undo2 size={14} />
         </button>

         <button 
           onClick={onToggleVoice} 
           className={`p-1.5 rounded hover:bg-white/10 transition-colors ${voiceEnabled ? 'text-diesel-green' : 'text-diesel-steel opacity-50'}`}
           title="Voice Toggle"
         >
            {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
         </button>
         
         <button 
           onClick={isSimulating ? onStopGame : onRunGame}
           className={`
              flex items-center gap-1 px-2 py-1 ml-1 text-[10px] font-bold tracking-widest border transition-all
              ${isSimulating 
                 ? 'bg-diesel-rust text-black border-diesel-rust hover:bg-white' 
                 : 'bg-diesel-green/10 text-diesel-green border-diesel-green hover:bg-diesel-green hover:text-black'}
           `}
         >
            {isSimulating ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
            <span className="hidden md:inline">{isSimulating ? 'ABORT' : 'RUN'}</span>
         </button>

      </div>
    </div>
  );
};