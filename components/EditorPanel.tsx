import React from 'react';
import { Monitor, Play, Square } from 'lucide-react';
import { GameData, SelectionState, Actor, Scene, Drop, GameInfo, Sfx, Item, SelectionType } from '../types';
import { SettingsEditor } from './editors/SettingsEditor';
import { ActorEditor } from './editors/ActorEditor';
import { SceneEditor } from './editors/SceneEditor';
import { DropEditor } from './editors/ScreenEditor'; // Renamed component, same file path
import { SfxEditor } from './editors/SfxEditor';
import { ItemEditor } from './editors/ItemEditor';

interface EditorPanelProps {
  game: GameData;
  selection: SelectionState;
  onUpdateActor: (id: string, updates: Partial<Actor>) => void;
  onDeleteActor: (id: string) => void;
  onUpdateInfo: (field: keyof GameInfo, value: any) => void;
  onUpdateWorldState: (key: string, value: string | number | boolean) => void;
  onDeleteWorldState: (key: string) => void;
  onUpdateScene: (id: string, updates: Partial<Scene>) => void;
  onDeleteScene: (id: string) => void;
  onAddScene: () => void;
  onUpdateDrop: (id: string, updates: Partial<Drop>) => void;
  onDeleteDrop: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<Item>) => void;
  onDeleteItem: (id: string) => void;
  onUpdateSfx: (id: string, updates: Partial<Sfx>) => void;
  onDeleteSfx: (id: string) => void;
  onToggleSimulation: () => void;
  isSimulating: boolean;
  voiceEnabled: boolean;
  onAddDropForScene: (sceneId: string) => void;
  onSelect: (type: SelectionType, id: string | null, subId?: string) => void;
  isFullWidth?: boolean;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ 
  game, 
  selection, 
  onUpdateActor, 
  onDeleteActor, 
  onUpdateInfo, 
  onUpdateWorldState, 
  onDeleteWorldState,
  onUpdateScene,
  onDeleteScene,
  onAddScene,
  onUpdateDrop,
  onDeleteDrop,
  onUpdateItem,
  onDeleteItem,
  onUpdateSfx,
  onDeleteSfx,
  onToggleSimulation,
  isSimulating,
  voiceEnabled,
  onAddDropForScene,
  onSelect,
  isFullWidth
}) => {
  
  const renderContent = () => {
    // -- GAME SETTINGS --
    if (selection.type === 'settings') {
      return (
        <div className="p-6">
          <SettingsEditor 
            key="settings"
            game={game}
            onUpdateInfo={onUpdateInfo}
            onUpdateWorldState={onUpdateWorldState}
            onDeleteWorldState={onDeleteWorldState}
            onAddScene={onAddScene}
          />
        </div>
      );
    }

    // -- ACTOR EDITOR --
    if (selection.type === 'actor') {
      const actor = game.actors.find(a => a.id === selection.id);
      if (actor) {
        return (
          <div className="p-6">
            <ActorEditor 
              key={actor.id} 
              game={game}
              actor={actor}
              onUpdateActor={onUpdateActor}
              onDeleteActor={onDeleteActor}
              onUpdateInfo={onUpdateInfo}
              voiceEnabled={voiceEnabled}
              onSelect={onSelect}
            />
          </div>
        );
      }
    }

    // -- SCENE EDITOR (Full Bleed handled internally) --
    if (selection.type === 'scene') {
      const scene = game.scenes.find(s => s.id === selection.id);
      if (scene) {
        return (
          <SceneEditor 
            key={scene.id}
            game={game}
            scene={scene}
            onUpdateScene={onUpdateScene}
            onDeleteScene={onDeleteScene}
            onUpdateActor={onUpdateActor}
            onAddDropForScene={onAddDropForScene}
            onUpdateDrop={onUpdateDrop}
            onSelect={onSelect}
            onUpdateInfo={onUpdateInfo}
            isSimulating={isSimulating}
            voiceEnabled={voiceEnabled}
          />
        );
      }
    }

    // -- DROP EDITOR (Was Screen) --
    if (selection.type === 'drop') {
      const drop = game.drops.find(s => s.id === selection.id);
      if (drop) {
        return (
          <div className="h-full">
            <DropEditor 
              key={drop.id}
              game={game}
              drop={drop}
              onUpdateDrop={onUpdateDrop}
              onDeleteDrop={onDeleteDrop}
              voiceEnabled={voiceEnabled}
              onReturn={selection.returnTo ? () => onSelect(selection.returnTo!.type, selection.returnTo!.id) : undefined}
            />
          </div>
        );
      }
    }

    // -- ITEM EDITOR --
    if (selection.type === 'item') {
      const item = game.items.find(i => i.id === selection.id);
      if (item) {
        return (
          <div className="p-6">
            <ItemEditor 
              key={item.id}
              game={game}
              item={item}
              onUpdateItem={onUpdateItem}
              onDeleteItem={onDeleteItem}
            />
          </div>
        );
      }
    }

    // -- SFX EDITOR --
    if (selection.type === 'sfx') {
       const sfx = game.sfx.find(s => s.id === selection.id);
       if (sfx) {
         return (
           <div className="p-6 h-full">
             <SfxEditor 
               key={sfx.id}
               sfx={sfx}
               onUpdateSfx={onUpdateSfx}
               onDeleteSfx={onDeleteSfx}
               game={game}
               onUpdateActor={onUpdateActor}
               onSelect={onSelect}
             />
           </div>
         );
       }
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-diesel-steel opacity-50">
        <Monitor size={48} className="mb-4" />
        <p className="tracking-widest text-xs">SELECT A MODULE TO EDIT</p>
      </div>
    );
  };

  return (
    <div className="flex-1 w-full h-full bg-diesel-panel border-r border-diesel-border flex flex-col shrink-0 transition-[width] duration-300 ease-in-out">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {renderContent()}
      </div>

      {selection.type === 'scene' && game.scenes.find(s => s.id === selection.id) && (
        <div className="p-4 border-t border-diesel-border bg-diesel-black shrink-0 relative z-20">
            <button 
                onClick={onToggleSimulation}
                className={`w-full py-3 px-4 font-bold tracking-widest text-sm flex items-center justify-center gap-2 transition-all border-2 ${
                    isSimulating 
                    ? 'bg-diesel-rust/20 text-diesel-rust border-diesel-rust hover:bg-diesel-rust hover:text-black' 
                    : 'bg-diesel-gold/20 text-diesel-gold border-diesel-gold hover:bg-diesel-gold hover:text-black'
                }`}
            >
                {isSimulating ? <><Square size={16} fill="currentColor" /> STOP SIMULATION</> : <><Play size={16} fill="currentColor" /> RUN SIMULATION</>}
            </button>
        </div>
      )}
    </div>
  );
};