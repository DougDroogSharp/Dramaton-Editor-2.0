import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { EditorPanel } from './components/EditorPanel';
import { GameData, SelectionState, Actor, Scene, SceneType, Drop, GameInfo, Sfx, Item } from './types';
import { INITIAL_GAME_DATA, SCENE_TYPES, SFX_CATEGORIES, SFX_TYPES } from './constants';
import { DramatonLogo } from './components/DramatonLogo';
import { CyberInput } from './components/CyberInput';
import { ChevronRight, AlertTriangle, RotateCcw, FolderOpen, Volume2, VolumeX, Undo2, Download } from 'lucide-react';
import { speak, stopSpeech } from './utils/voice';
import { saveGameToDB, loadGameFromDB } from './utils/db';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substr(2, 9);
};

const App: React.FC = () => {
  const [game, setGame] = useState<GameData>(INITIAL_GAME_DATA);
  const [history, setHistory] = useState<GameData[]>([]); // Undo stack sss
  const [selection, setSelection] = useState<SelectionState>({ type: 'settings', id: null });
  
  // Initialization State
  const [isStarted, setIsStarted] = useState(false);
  const [startTitle, setStartTitle] = useState("");
  const [startAuthor, setStartAuthor] = useState("");
  const [hasAutoSave, setHasAutoSave] = useState(false); // Kept for legacy IDB checks
  const [autoSaveError, setAutoSaveError] = useState(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);
  
  // Simulation State xxx
  const [isSimulating, setIsSimulating] = useState(false);

  // Accessibility State
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Ref for startup file loader and global loader
  const startupFileRef = useRef<HTMLInputElement>(null);
  const globalFileRef = useRef<HTMLInputElement>(null);
  
  // Ref for Game State (to avoid stale closures in intervals) xxxx
  const gameRef = useRef(game);

  // Pacing Protocol State
  const [minutes, setMinutes] = useState(new Date().getMinutes());

  // Update ref whenever game changes
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // -- Initialization & Local Keys --
  useEffect(() => {
    // Check for IDB save (Legacy support or initial load)
    loadGameFromDB().then((saved) => {
        if (saved && saved.info) {
            setHasAutoSave(true);
        }
    });

    // Load Local Keys (Secure Key Handling) - Initial Load
    const localElevenLabsKey = localStorage.getItem('dramaton_env_elevenlabs');
    if (localElevenLabsKey) {
       setGame(prev => ({
          ...prev,
          info: { ...prev.info, elevenLabsApiKey: localElevenLabsKey }
       }));
    }

    const timer = setInterval(() => {
      setMinutes(new Date().getMinutes());
    }, 10000); // Check every 10 seconds
    return () => clearInterval(timer);
  }, []);

  // Sync API Key between State and LocalStorage
  useEffect(() => {
    const localKey = localStorage.getItem('dramaton_env_elevenlabs');
    const stateKey = game.info.elevenLabsApiKey;

    // If state has a key, ensure it's saved to local storage
    if (stateKey && stateKey !== localKey) {
        localStorage.setItem('dramaton_env_elevenlabs', stateKey);
    }
    // If state is missing key but local storage has it (e.g. after file load), restore it
    else if (!stateKey && localKey) {
        setGame(prev => ({
            ...prev,
            info: { ...prev.info, elevenLabsApiKey: localKey }
        }));
    }
  }, [game.info.elevenLabsApiKey]);

  // -- AUTOSAVE PROTOCOL: FILE BASED (5 Minutes) --
  useEffect(() => {
    if (isStarted && game.info.enableAutosave) {
        // Interval: 5 Minutes (300,000 ms)
        const intervalId = setInterval(() => {
            // Check Pacing Protocol dynamically
            const currentMinutes = new Date().getMinutes();
            const isResting = currentMinutes > 30; // 31-59 is rest time
            
            if (!isResting) {
                handleSaveGame(gameRef.current, true); // Pass true for isAutosave
            } else {
                console.log("Autosave skipped: Pacing Protocol Active");
            }
        }, 5 * 60 * 1000); 

        return () => clearInterval(intervalId);
    }
  }, [isStarted, game.info.enableAutosave]); 

  // -- AUTOSAVE NOTIFICATION CLEANUP --
  useEffect(() => {
    if (lastAutoSaveTime) {
      const timer = setTimeout(() => {
        setLastAutoSaveTime(null);
      }, 2000); // Dismiss after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [lastAutoSaveTime]);

  const isRestPeriod = minutes > 30; // 31-59 is rest time

  // -- Helpers --
  const getUniqueName = (baseName: string, existingNames: string[]) => {
    let name = baseName;
    let counter = 1;
    while (existingNames.includes(name)) {
      name = `${baseName} (${counter})`;
      counter++;
    }
    return name;
  };

  const isDefaultName = (name: string, type: 'Actor' | 'Scene' | 'Drop' | 'Effect' | 'Item') => {
     const base = `New ${type}`;
     const regex = new RegExp(`^${base}( \\(\\d+\\))?$`);
     return regex.test(name);
  };

  const toggleSimulation = () => {
    setIsSimulating(!isSimulating);
  };

  const runFullGame = () => {
    // Start from Title Scene if configured, else just run current
    setIsSimulating(true);
  };

  const toggleVoice = () => {
    if (voiceEnabled) {
      stopSpeech();
      setVoiceEnabled(false);
    } else {
      setVoiceEnabled(true);
    }
  };

  // -- Undo Logic --
  const pushHistory = (newState: GameData) => {
    setHistory(prev => {
      const newHistory = [...prev, game];
      if (newHistory.length > 20) newHistory.shift(); // Limit stack size
      return newHistory;
    });
    setGame(newState);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setGame(previousState);

    // FIX: Check if the currently selected item exists in the restored state.
    // If we undo creation of an object, we must deselect it to avoid a crash/black screen.
    if (selection.id && selection.type !== 'settings') {
       let exists = false;
       switch(selection.type) {
          case 'actor': exists = previousState.actors.some(a => a.id === selection.id); break;
          case 'scene': exists = previousState.scenes.some(s => s.id === selection.id); break;
          case 'drop': exists = previousState.drops.some(d => d.id === selection.id); break;
          case 'item': exists = previousState.items.some(i => i.id === selection.id); break;
          case 'sfx': exists = previousState.sfx.some(s => s.id === selection.id); break;
          default: exists = true;
       }

       if (!exists) {
          setSelection({ type: 'settings', id: null });
       }
    }
  };

  // Wrapper for state updates to ensure history is tracked
  const updateGame = (updater: (prev: GameData) => GameData) => {
    setGame(prev => {
      const newState = updater(prev);
      setHistory(h => [...h, prev].slice(-20)); 
      return newState;
    });
  };

  // -- Handlers --

  const handleStartGame = () => {
    if (!startTitle.trim() || !startAuthor.trim()) return;
    
    // Check if we have a local key to inject
    const localElevenLabsKey = localStorage.getItem('dramaton_env_elevenlabs');

    setGame(prev => ({
      ...prev,
      info: {
        ...prev.info,
        title: startTitle,
        author: startAuthor,
        elevenLabsApiKey: localElevenLabsKey || prev.info.elevenLabsApiKey
      }
    }));
    setIsStarted(true);
  };

  const handleResumeGame = async () => {
    const saved = await loadGameFromDB();
    if (saved) {
        // RE-INJECT LOCAL KEYS 
        const localElevenLabsKey = localStorage.getItem('dramaton_env_elevenlabs');
        if (localElevenLabsKey) {
            saved.info.elevenLabsApiKey = localElevenLabsKey;
        }

        setGame(saved);
        setIsStarted(true);
    } else {
        alert("No saved session found.");
    }
  };

  const handleStartupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLoadGame(file);
    }
    if (startupFileRef.current) {
      startupFileRef.current.value = '';
    }
  };

  // Separate handler for global hotkey load
  const handleGlobalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLoadGame(file);
    }
    if (globalFileRef.current) {
      globalFileRef.current.value = '';
    }
  };

  const handleLoadGame = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const parsed = JSON.parse(result);
        if (parsed.info && parsed.actors) {
          
          // RE-INJECT LOCAL KEYS 
          const localElevenLabsKey = localStorage.getItem('dramaton_env_elevenlabs');
          if (localElevenLabsKey) {
             parsed.info.elevenLabsApiKey = localElevenLabsKey;
          }

          setGame(parsed);
          setIsStarted(true);
          setSelection({ type: 'settings', id: null });
          setAutoSaveError(false);
        } else {
          alert("Invalid Dramaton Game File");
        }
      } catch (err) {
        console.error("Load failed", err);
        alert("Failed to parse game file.");
      }
    };
    reader.readAsText(file);
  };

  const handleSaveGame = (gameDataToSave: GameData = game, isAutosave: boolean = false) => {
    // SECURITY: STRIP API KEYS BEFORE SAVING
    const safeGame = {
      ...gameDataToSave,
      info: {
        ...gameDataToSave.info,
        elevenLabsApiKey: undefined // Remove key from file
      }
    };

    // USE BLOB API FOR LARGE FILES (Fixes size limit crash)
    const jsonString = JSON.stringify(safeGame);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);
    
    const suffix = isAutosave ? `_AUTOSAVE_${new Date().toLocaleTimeString().replace(/:/g,'-')}` : '';
    const filename = `dramaton_protocol_${safeGame.info.title.replace(/\s+/g, '_').toLowerCase()}${suffix}.dram`;
    
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    // Release memory
    URL.revokeObjectURL(url);

    if (isAutosave) {
        setLastAutoSaveTime(new Date());
    }
  };

  // -- Core Data Updates (Wrapped with History) --

  const updateInfo = (field: keyof GameInfo, value: any) => {
    // SECURITY: If updating the API Key, save it to LocalStorage immediately
    if (field === 'elevenLabsApiKey') {
       if (value) {
         localStorage.setItem('dramaton_env_elevenlabs', value);
       } else {
         localStorage.removeItem('dramaton_env_elevenlabs');
       }
    }

    updateGame(prev => ({
      ...prev,
      info: { ...prev.info, [field]: value }
    }));
  };

  const updateWorldState = (key: string, value: string | number | boolean) => {
    updateGame(prev => ({
      ...prev,
      info: {
        ...prev.info,
        worldState: { ...prev.info.worldState, [key]: value }
      }
    }));
  };

  const deleteWorldState = (key: string) => {
    updateGame(prev => {
       const newState = { ...prev.info.worldState };
       delete newState[key];
       return {
         ...prev,
         info: { ...prev.info, worldState: newState }
       };
    });
  };

  const addActor = () => {
    const name = getUniqueName("New Actor", game.actors.map(a => a.name));
    const newActor: Actor = {
      id: generateId(),
      name,
      image: null,
      referenceImageCloseUp: null,
      referenceImageFullBody: null,
      graphics: []
    };
    updateGame(prev => ({ ...prev, actors: [...prev.actors, newActor] }));
    setSelection({ type: 'actor', id: newActor.id });
  };

  const updateActor = (id: string, updates: Partial<Actor>) => {
    updateGame(prev => ({
      ...prev,
      actors: prev.actors.map(a => a.id === id ? { ...a, ...updates } : a)
    }));
  };

  const deleteActor = (id: string) => {
    updateGame(prev => ({
      ...prev,
      actors: prev.actors.filter(a => a.id !== id),
      scenes: prev.scenes.map(s => ({
        ...s,
        stage: s.stage?.filter(el => el.assetId !== id)
      }))
    }));
    if (selection.id === id) setSelection({ type: 'settings', id: null });
  };

  const addScene = () => {
    const name = getUniqueName("New Scene", game.scenes.map(s => s.name));
    const newScene: Scene = {
      id: generateId(),
      name,
      type: SCENE_TYPES.AGENCY,
      script: "",
      requirements: {},
      stage: []
    };
    updateGame(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }));
    setSelection({ type: 'scene', id: newScene.id });
  };

  const updateScene = (id: string, updates: Partial<Scene>) => {
    updateGame(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const deleteScene = (id: string) => {
    updateGame(prev => ({
      ...prev,
      scenes: prev.scenes.filter(s => s.id !== id)
    }));
    if (selection.id === id) setSelection({ type: 'settings', id: null });
  };

  const addDrop = () => {
    const name = getUniqueName("New Drop", game.drops.map(s => s.name));
    const newDrop: Drop = {
      id: generateId(),
      name,
      prompt: "",
      image: null
    };
    updateGame(prev => ({ ...prev, drops: [...prev.drops, newDrop] }));
    setSelection({ type: 'drop', id: newDrop.id });
  };

  const addDropForScene = (sceneId: string) => {
    const name = getUniqueName("Backdrop", game.drops.map(s => s.name));
    const newDrop: Drop = {
      id: generateId(),
      name,
      prompt: "",
      image: null
    };
    
    // Update game: Add drop AND update scene link
    updateGame(prev => ({
      ...prev,
      drops: [...prev.drops, newDrop],
      scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, dropId: newDrop.id } : s)
    }));

    setSelection({ 
      type: 'drop', 
      id: newDrop.id, 
      returnTo: { type: 'scene', id: sceneId } 
    });
  };

  const updateDrop = (id: string, updates: Partial<Drop>) => {
    updateGame(prev => ({
      ...prev,
      drops: prev.drops.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const deleteDrop = (id: string) => {
    updateGame(prev => ({
      ...prev,
      drops: prev.drops.filter(s => s.id !== id)
    }));
    if (selection.id === id) setSelection({ type: 'settings', id: null });
  };

  const addItem = () => {
    const name = getUniqueName("New Item", game.items.map(i => i.name));
    const newItem: Item = {
      id: generateId(),
      name,
      category: 'prop',
      acquisition: 'pickup',
      unlockCondition: null,
      effects: [],
      visualAsset: null
    };
    updateGame(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setSelection({ type: 'item', id: newItem.id });
  };

  const updateItem = (id: string, updates: Partial<Item>) => {
    updateGame(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, ...updates } : i)
    }));
  };

  const deleteItem = (id: string) => {
    updateGame(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== id)
    }));
    if (selection.id === id) setSelection({ type: 'settings', id: null });
  };

  const addSfx = () => {
     const name = getUniqueName("New Effect", game.sfx.map(s => s.name));
     const newSfx: Sfx = {
       id: generateId(),
       name,
       category: 'ATTACH',
       type: 'glow',
       params: { intensity: 50, speed: 50, color: '#d900ff' }
     };
     updateGame(prev => ({ ...prev, sfx: [...prev.sfx, newSfx] }));
     setSelection({ type: 'sfx', id: newSfx.id });
  };

  const updateSfx = (id: string, updates: Partial<Sfx>) => {
    updateGame(prev => ({
      ...prev,
      sfx: prev.sfx.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const deleteSfx = (id: string) => {
    updateGame(prev => ({
      ...prev,
      sfx: prev.sfx.filter(s => s.id !== id)
    }));
    if (selection.id === id) setSelection({ type: 'settings', id: null });
  };

  // -- Hotkeys --
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Allow default behavior in inputs/textareas unless it's a global command that doesn't conflict
      const isInput = target.matches('input, textarea, select, [contenteditable]');

      // Ctrl + S: Save (Global override)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        handleSaveGame(game, false);
        return;
      }

      // Ctrl + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (!isInput) {
            e.preventDefault();
            handleUndo();
        }
        return;
      }

      // Ctrl + A: Add Actor
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (!isInput) {
            e.preventDefault();
            addActor();
        }
        return;
      }

      // Ctrl + Shift + S: Add Scene
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
         if (!isInput) {
             e.preventDefault();
             addScene();
         }
         return;
      }

      // Ctrl + Enter: Toggle Run/Stop
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          if (isSimulating) {
              toggleSimulation();
          } else {
              runFullGame();
          }
      }

      // NEW HOTKEYS

      // Ctrl + , : Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
          e.preventDefault();
          setSelection({ type: 'settings', id: null });
      }

      // Ctrl + O : Open/Load
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
          e.preventDefault();
          globalFileRef.current?.click();
      }

      // Ctrl + Shift + D : Add Drop (Was C/Screen)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
         if (!isInput) {
             e.preventDefault();
             addDrop();
         }
      }

      // Ctrl + I : Add Item
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
         if (!isInput) {
            e.preventDefault();
            addItem();
         }
      }

      // Ctrl + E : Add SFX
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
         if (!isInput) {
            e.preventDefault();
            addSfx();
         }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [game, history, isSimulating]);


  // -- Render --

  if (!isStarted) {
    return (
      <div className="w-screen h-screen bg-diesel-black text-diesel-gold flex items-center justify-center p-8 relative overflow-hidden scanlines">
        
        <div className="absolute top-4 right-4 z-50">
           <button onClick={toggleVoice} className="text-diesel-gold hover:text-white transition-colors">
              {voiceEnabled ? <Volume2 /> : <VolumeX />}
           </button>
        </div>
        
        <div className="max-w-md w-full z-10 animate-fade-in">
          <div className="flex justify-center mb-8">
             <DramatonLogo className="w-32 h-32 animate-pulse text-diesel-rust" />
          </div>
          <h1 className="text-4xl font-bold text-center mb-2 tracking-tighter text-diesel-paper border-b-4 border-diesel-rust pb-2">DRAMATON <span className="text-diesel-rust">2.0</span></h1>
          <p className="text-center text-xs tracking-widest text-diesel-steel mb-8 font-mono">DIESELPUNK NARRATIVE ARCHITECT v2.5</p>
          
          <div className="bg-diesel-panel border-2 border-diesel-border p-8 shadow-diesel-glow rounded-sm">
            
            {hasAutoSave && (
               <button 
                 onClick={handleResumeGame}
                 className="w-full bg-diesel-gold text-black font-bold py-3 mb-6 hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2 group border border-diesel-gold"
               >
                 <RotateCcw className="group-hover:-rotate-180 transition-transform duration-500" />
                 RESUME SESSION
               </button>
            )}

            <div className="space-y-4 mb-6">
              <CyberInput 
                label="Game Title" 
                value={startTitle} 
                onChange={(e) => setStartTitle(e.target.value)}
                placeholder="ENTER PROJECT NAME"
              />
              <CyberInput 
                label="Creator's Name" 
                value={startAuthor} 
                onChange={(e) => setStartAuthor(e.target.value)}
                placeholder="ENTER YOUR NAME"
              />
            </div>
            
            <button 
              onClick={handleStartGame}
              disabled={!startTitle || !startAuthor}
              className={`w-full font-bold py-3 border-2 transition-all flex items-center justify-center gap-2
                ${startTitle && startAuthor ? 'bg-diesel-black text-diesel-rust border-white hover:bg-white hover:text-diesel-rust' : 'opacity-50 cursor-not-allowed text-diesel-steel border-diesel-border'}
              `}
            >
              CREATE NEW GAME <ChevronRight />
            </button>

            <label className="w-full font-bold py-3 mt-4 border-2 border-white bg-diesel-black text-diesel-rust transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-white hover:text-diesel-rust">
                 LOAD GAME
                 <input 
                   type="file" 
                   className="hidden" 
                   accept=".dram"
                   ref={startupFileRef}
                   onChange={handleStartupFileChange}
                 />
            </label>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-[10px] text-diesel-steel font-mono">SYSTEM STATUS: <span className="text-diesel-green">ONLINE</span></p>
            <p className="text-[10px] text-diesel-steel font-mono mt-1">VOICE MODULE: <span className={voiceEnabled ? "text-diesel-gold" : "text-diesel-steel"}>{voiceEnabled ? "ACTIVE" : "SILENT"}</span></p>
            <p className="text-[10px] text-diesel-steel font-mono mt-1">PACING PROTOCOL: <span className={isRestPeriod ? "text-diesel-rust font-bold" : "text-diesel-steel"}>{isRestPeriod ? "ACTIVE (LOCKED)" : "STANDBY"}</span></p>
          </div>
        </div>
      </div>
    );
  }

  // Determine if we are in Drop Editing mode to adjust layout
  const isDropEditing = selection.type === 'drop';

  return (
    <div className="flex flex-col h-screen w-screen bg-diesel-black text-diesel-paper overflow-hidden font-mono selection:bg-diesel-gold selection:text-black relative">
      
      {/* REST PROTOCOL OVERLAY */}
      {isRestPeriod && (
         <div className="fixed inset-0 z-[9999] bg-diesel-black flex flex-col items-center justify-center p-8 select-none">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>
            
            <div className="border-4 border-diesel-rust p-12 bg-black shadow-[0_0_50px_rgba(166,77,45,0.3)] max-w-3xl w-full text-center relative overflow-hidden animate-pulse">
                <div className="absolute top-0 left-0 w-full h-2 bg-diesel-rust"></div>
                <div className="absolute bottom-0 left-0 w-full h-2 bg-diesel-rust"></div>
                
                <AlertTriangle size={80} className="text-diesel-rust mx-auto mb-6" />
                
                <h1 className="text-5xl font-bold text-diesel-rust mb-6 tracking-tighter uppercase font-sans glitch-text">
                   MANDATORY REST
                </h1>
                
                <p className="text-xl text-diesel-paper font-mono mb-8 leading-relaxed uppercase">
                   Protocol 31-59 Active. System Locked.
                   <br/>
                   Take a break, Architect.
                </p>
                
                <div className="bg-diesel-rust/10 border border-diesel-rust/30 p-6 inline-block">
                   <div className="text-sm text-diesel-steel font-mono mb-2">SYSTEM CLOCK</div>
                   <div className="text-3xl font-bold text-diesel-gold font-mono">
                      {new Date().toLocaleTimeString()}
                   </div>
                   <div className="text-xs text-diesel-rust mt-2 uppercase tracking-widest">
                      RESUMING AT TOP OF THE HOUR
                   </div>
                </div>
            </div>
         </div>
      )}

      {/* Hidden Global File Input for Hotkey */}
      <input type="file" className="hidden" accept=".dram" ref={globalFileRef} onChange={handleGlobalFileChange} />

      {/* Sidebar Navigation - Now acting as Top Navigation */}
      <Sidebar 
        game={game} 
        selection={selection}
        onSelect={(type, id, subId) => {
           setSelection({ type, id, subId });
           if(voiceEnabled) stopSpeech();
        }}
        onAddActor={addActor}
        onAddScene={addScene}
        onAddDrop={addDrop}
        onAddItem={addItem}
        onAddSfx={addSfx}
        onSave={() => handleSaveGame(game, false)}
        onLoad={handleLoadGame}
        isRestPeriod={isRestPeriod}
        autoSaveError={autoSaveError}
        voiceEnabled={voiceEnabled}
        onToggleVoice={toggleVoice}
        onUndo={handleUndo}
        canUndo={history.length > 0}
        onRunGame={runFullGame}
        isSimulating={isSimulating}
        onStopGame={toggleSimulation}
        onUpdateInfo={updateInfo}
      />

      {/* Main Content Area - Split between Editor and Preview */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Autosave Toast Notification */}
        {lastAutoSaveTime && (
           <div 
             key={lastAutoSaveTime.getTime()} 
             className="absolute top-4 right-4 z-[100] flex items-center gap-2 px-4 py-2 bg-diesel-black/90 border border-diesel-green text-diesel-green rounded shadow-lg animate-[fadeOut_4s_forwards]"
           >
              <Download size={14} />
              <div className="flex flex-col">
                  <span className="text-xs font-bold tracking-widest">AUTOSAVE COMPLETE</span>
                  <span className="text-[10px] opacity-70">Protocol downloaded to disk.</span>
              </div>
           </div>
        )}

        {/* PERSISTENT AUTOSAVE INDICATOR - Per Request */}
        {game.info.enableAutosave && !lastAutoSaveTime && (
           <div className="absolute top-4 right-20 z-[90] text-[9px] text-diesel-steel opacity-50 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-diesel-green animate-pulse"></div>
              PROTOCOL ACTIVE
           </div>
        )}

        <EditorPanel 
          game={game}
          selection={selection}
          onUpdateActor={updateActor}
          onDeleteActor={deleteActor}
          onUpdateInfo={updateInfo}
          onUpdateWorldState={updateWorldState}
          onDeleteWorldState={deleteWorldState}
          onUpdateScene={updateScene}
          onDeleteScene={deleteScene}
          onAddScene={addScene}
          onUpdateDrop={updateDrop}
          onDeleteDrop={deleteDrop}
          onUpdateItem={updateItem}
          onDeleteItem={deleteItem}
          onUpdateSfx={updateSfx}
          onDeleteSfx={deleteSfx}
          onToggleSimulation={toggleSimulation}
          isSimulating={isSimulating}
          voiceEnabled={voiceEnabled}
          onAddDropForScene={addDropForScene}
          onSelect={(type, id, subId) => setSelection({ type, id, subId })}
          isFullWidth={true}
        />
        
      </div>
    </div>
  );
};

export default App;