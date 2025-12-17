import React, { useState, useEffect, useRef } from 'react';
import { Download, Maximize, Minimize, ChevronLeft, ChevronRight, Play, Package, Type, Eye, History, Volume2, SkipForward, Save, LogOut, Sparkles } from 'lucide-react';
import { GameData, SelectionState, Scene, Drop, Actor, Sfx, GameInfo, Item, StageElement } from '../types';
import { SCENE_TYPES, WITNESS_REACTIONS } from '../constants';
import { DramatonLogo } from './DramatonLogo';
import { speak } from '../utils/voice';

interface PreviewPanelProps {
  game: GameData;
  selection: SelectionState;
  isSimulating?: boolean;
  voiceEnabled: boolean;
  onNavigateToScene?: (sceneId: string) => void;
  onSaveGame?: () => void;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ game, selection, isSimulating, voiceEnabled, onNavigateToScene, onSaveGame }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [graphicIndex, setGraphicIndex] = useState(0);
  const [triggerKey, setTriggerKey] = useState(0); 

  // -- ACCESSIBILITY GAME RUNNER STATE --
  const [scriptLines, setScriptLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [historyLog, setHistoryLog] = useState<{actor: string, text: string}[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // -- SCENE END / MENU STATE --
  const [showSceneEndMenu, setShowSceneEndMenu] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  
  // -- ESTABLISHING SHOT STATE --
  const [showingEstablishingShot, setShowingEstablishingShot] = useState(false);

  // Accessibility Preferences
  const [textSize, setTextSize] = useState<'normal' | 'large' | 'huge'>('normal');
  const [highContrast, setHighContrast] = useState(false);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [showA11yMenu, setShowA11yMenu] = useState(false);

  // Reset graphic index when actor changes
  useEffect(() => {
    setGraphicIndex(0);
    setIsMaximized(false); // Reset maximize on selection change
  }, [selection.id, selection.type]);

  // -- GAME RUNNER INITIALIZATION --
  useEffect(() => {
    // Reset states when changing selection/scene
    setShowSceneEndMenu(false);
    setShowCredits(false);
    
    if (isSimulating && selection.type === 'scene') {
      const scene = getDisplayData() as Scene;
      
      // Determine if we show establishing shot
      if (scene && scene.dropId) {
         setShowingEstablishingShot(true);
      } else {
         setShowingEstablishingShot(false);
         // If no drop, start script immediately
         startScript(scene);
      }
    } else {
      setShowingEstablishingShot(false);
      // Cleanup audio when stopping simulation
      if (audioElement) {
        audioElement.pause();
        setAudioElement(null);
      }
    }
  }, [isSimulating, selection.id, game.scenes]); // Added game.scenes dependency to ensure drop link changes are caught

  // Effect to start script AFTER establishing shot is dismissed
  useEffect(() => {
     if (isSimulating && selection.type === 'scene' && !showingEstablishingShot) {
        const scene = getDisplayData() as Scene;
        startScript(scene);
     }
  }, [showingEstablishingShot, isSimulating, selection.id]);


  const startScript = (scene: Scene | undefined) => {
      if (scene && scene.script) {
        const lines = scene.script.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('//'));
        setScriptLines(lines);
        setCurrentLineIndex(0);
        
        // Auto-play first line if it exists
        if(lines.length > 0) {
           playLineAudio(lines[0], scene);
        }
      } else {
        setScriptLines([]);
      }
  };

  const playLineAudio = (line: string, scene: Scene) => {
    if (audioElement) {
      audioElement.pause();
    }
    
    // Ignore commands like >> GOTO
    if (line.startsWith('>>')) return;

    // Try to find matching audio in Scene Audio Data
    if (scene.audioData && scene.audioData[line]) {
      const audio = new Audio(scene.audioData[line]);
      audio.volume = 1.0; 
      audio.play();
      setAudioElement(audio);
    } else if (voiceEnabled) {
      speak(line); 
    }
  };

  const handleNextLine = () => {
    if (!isSimulating) return;
    const scene = getDisplayData() as Scene;
    
    if (currentLineIndex < scriptLines.length - 1) {
      const nextIndex = currentLineIndex + 1;
      const nextLine = scriptLines[nextIndex];

      // -- COMMAND PARSING (GOTO) --
      if (nextLine.trim().startsWith('>> GOTO:')) {
         const targetSceneName = nextLine.split('GOTO:')[1].trim();
         const targetScene = game.scenes.find(s => s.name === targetSceneName);
         if (targetScene && onNavigateToScene) {
            onNavigateToScene(targetScene.id);
            return;
         } else {
            console.warn(`Scene '${targetSceneName}' not found.`);
         }
      }

      setCurrentLineIndex(nextIndex);
      
      // Add previous to history
      const prevLine = scriptLines[currentLineIndex];
      if (!prevLine.startsWith('>>')) {
         const [actor, text] = prevLine.includes(':') ? prevLine.split(':') : ['Narrator', prevLine];
         setHistoryLog(prev => [...prev, { actor: actor.trim(), text: text?.trim() || actor.trim() }]);
      }

      playLineAudio(nextLine, scene);
    } else {
      // End of script in this scene. Trigger Menu/Autosave
      handleSceneComplete();
    }
  };

  const handleSceneComplete = () => {
     // 2. Show Menu
     setShowSceneEndMenu(true);
  };

  const handleEndSession = () => {
     setShowSceneEndMenu(false);
     setShowCredits(true);
  };

  const getDisplayData = () => {
    if (selection.type === 'settings') return game.info;
    if (selection.type === 'actor') return game.actors.find(a => a.id === selection.id);
    if (selection.type === 'scene') return game.scenes.find(s => s.id === selection.id);
    if (selection.type === 'drop') return game.drops.find(s => s.id === selection.id);
    if (selection.type === 'item') return game.items.find(i => i.id === selection.id);
    if (selection.type === 'sfx') return game.sfx.find(s => s.id === selection.id);
    return null;
  };

  // --- SFX HELPER (DUPLICATED FROM SCENE EDITOR FOR SIMULATION) ---
  const getSfxStyle = (element: StageElement): React.CSSProperties => {
      if (!element.activeSfx || element.activeSfx.length === 0) return {};
      let combinedStyle: React.CSSProperties = {};
      let filters: string[] = [];

      element.activeSfx.forEach(sfxId => {
          const sfx = game.sfx.find(s => s.id === sfxId);
          if (!sfx) return;
          const { intensity, speed, color } = sfx.params;

          if (sfx.type === 'glow') filters.push(`drop-shadow(0 0 ${intensity / 2}px ${color})`);
          if (sfx.type === 'pulse') {
              const durationSec = 2 - (speed! / 100) * 1.8;
              combinedStyle.animation = `sfx-pulse ${durationSec}s infinite ease-in-out`;
              filters.push(`drop-shadow(0 0 ${intensity / 5}px ${color})`);
          }
          if (sfx.type === 'shake') {
              const durationSec = 1 - (speed! / 100) * 0.9;
              combinedStyle.animation = `sfx-shake ${durationSec}s infinite linear`;
          }
          if (sfx.type === 'jiggle') {
              const durationSec = 1 - (speed! / 100) * 0.8;
              combinedStyle.animation = `sfx-jiggle ${durationSec}s infinite ease-in-out`;
          }
          if (sfx.type === 'fade') combinedStyle.opacity = (100 - intensity) / 100;
          if (sfx.type === 'electric' || (sfx.type as string) === 'flash') {
              const durationSec = 2.0 - ((speed || 50) / 100) * 1.8; 
              combinedStyle.animation = `sfx-electric ${durationSec}s infinite linear`;
              combinedStyle.color = color || '#ffff00';
          }
      });

      if (filters.length > 0) combinedStyle.filter = filters.join(' ');
      return combinedStyle;
  };

  const displayData = getDisplayData();

  // Helper to extract the current visible image URL for downloading
  const getCurrentVisual = (): string | null => {
    if (selection.type === 'drop' && displayData) {
      return (displayData as Drop).image;
    }
    if (selection.type === 'item' && displayData) {
      return (displayData as Item).visualAsset;
    }
    if (selection.type === 'actor' && displayData) {
      const actor = displayData as Actor;
      
      // If a specific subId is selected (graphic), prioritize that
      if (selection.subId) {
         const specificGraphic = actor.graphics?.find(g => g.id === selection.subId);
         if (specificGraphic) return specificGraphic.image;
      }

      const hasGraphics = actor.graphics && actor.graphics.length > 0;
      const currentGraphic = hasGraphics ? actor.graphics[graphicIndex % actor.graphics.length] : null;
      return currentGraphic?.image || actor.image || actor.referenceImageCloseUp || actor.referenceImageFullBody || null;
    }
    return null;
  };

  const currentVisualUrl = getCurrentVisual();

  const handleDownload = () => {
    if (!currentVisualUrl || !displayData) return;
    // @ts-ignore
    const name = displayData.name || "asset";
    const cleanName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const link = document.createElement('a');
    link.href = currentVisualUrl;
    link.download = `dramaton_${selection.type}_${cleanName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerEffect = () => {
    setTriggerKey(prev => prev + 1);
  };

  const handleStartGameClick = () => {
     if (onNavigateToScene) {
         if (game.info.titleSceneId) {
             const titleScene = game.scenes.find(s => s.id === game.info.titleSceneId);
             if (titleScene) {
                 onNavigateToScene(titleScene.id);
                 return;
             }
         }
         
         // Fallback to first scene
         if (game.scenes.length > 0) {
            onNavigateToScene(game.scenes[0].id);
         } else {
            alert("No scenes created yet. Please add a scene in the editor.");
         }
     }
  };

  // --- RENDERING HELPERS ---

  const renderVisual = () => {
    // -- SETTINGS PREVIEW (TITLE SCREEN) --
    if (selection.type === 'settings') {
      return (
        <div className={`flex flex-col items-center justify-center h-full border-4 border-double border-diesel-gold p-8 text-center bg-diesel-black relative overflow-hidden shadow-diesel-glow`}>
           <div className="absolute top-0 left-0 w-full h-1 bg-diesel-gold animate-pulse"></div>
           <div className="absolute bottom-0 left-0 w-full h-1 bg-diesel-gold animate-pulse"></div>
           
           <h1 className="text-4xl md:text-5xl font-bold text-diesel-gold mb-4 glitch-text uppercase tracking-tighter">
             {game.info.title || "UNTITLED"}
           </h1>
           <p className="text-sm text-diesel-gold/80 tracking-widest uppercase mb-12 font-mono">
             ARCHITECT: {game.info.author || "UNKNOWN"}
           </p>
           
           {isSimulating ? (
             <div className="flex flex-col items-center gap-4 z-10">
                <button 
                   onClick={handleStartGameClick}
                   className="px-10 py-4 bg-diesel-gold text-black font-bold text-xl hover:bg-white hover:text-black transition-all animate-pulse shadow-[0_0_20px_rgba(203,169,109,0.5)] uppercase tracking-widest border border-diesel-gold"
                >
                   INITIALIZE PROTOCOL
                </button>
                {game.info.titleSceneId && (
                   <div className="text-[10px] text-diesel-green uppercase tracking-widest">
                      Custom Title Scene Active
                   </div>
                )}
             </div>
           ) : (
             <div className="mt-12 text-xs animate-pulse text-diesel-gold/60 font-mono">
               SYSTEM STANDBY
             </div>
           )}

           {/* World State Ticker */}
           <div className="absolute bottom-4 left-0 w-full overflow-hidden bg-diesel-gold/10 border-y border-diesel-gold/20 py-1">
             <div className="whitespace-nowrap animate-[marquee_10s_linear_infinite] text-[10px] font-mono text-diesel-gold">
               {Object.entries(game.info.worldState).map(([k, v]) => ` [ ${k}: ${v} ] `).join(' /// ')}
               {Object.keys(game.info.worldState).length === 0 && " // CASSANDRA FEED OFFLINE // "}
             </div>
           </div>
        </div>
      );
    }
    
    // -- SFX TUNER PLACEHOLDER (NEW) --
    if (selection.type === 'sfx') {
        const sfx = displayData as Sfx;
        return (
          <div className="h-full border border-diesel-green/30 bg-diesel-black flex flex-col items-center justify-center text-diesel-green p-8">
            <Sparkles size={64} className="mb-6 animate-pulse" />
            <h2 className="text-2xl font-bold uppercase tracking-widest mb-2">Visual FX Tuner Active</h2>
            <p className="text-sm text-diesel-steel opacity-70 text-center max-w-md">
               You are currently editing <strong>"{sfx.name}"</strong> in the Inspector Panel on the left.
               Use the preview window there to test effects.
            </p>
            <div className="mt-8 p-4 border border-diesel-border/50 bg-black/50 text-xs font-mono text-diesel-steel">
                Current Mode: <span className="text-white font-bold">{sfx.category} / {sfx.type}</span>
            </div>
          </div>
        );
    }

    // -- CREDITS SCREEN --
    if (showCredits) {
      return (
        <div className={`h-full bg-diesel-black flex flex-col items-center justify-center text-center p-8 relative overflow-hidden animate-fade-in z-50`}>
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
           <div className="z-10 animate-[slideUp_20s_linear_infinite] flex flex-col items-center w-full max-w-md">
              <DramatonLogo className="w-24 h-24 mx-auto mb-8 text-diesel-rust" />
              <h1 className="text-4xl font-bold text-diesel-paper mb-2 uppercase tracking-widest">{game.info.title}</h1>
              <p className="text-diesel-steel text-sm mb-12">CREATED BY {game.info.author}</p>
              
              <div className="space-y-4 text-xs text-diesel-steel font-mono mb-12">
                 <p>NARRATIVE ENGINE: DRAMATON v2.5</p>
                 <p>VISUAL GENERATION: GEMINI NANO BANANA</p>
                 <p>VOICE SYNTHESIS: ELEVENLABS</p>
              </div>

              <div className="text-diesel-green text-sm font-bold animate-pulse">
                 THANKS FOR PLAYING
              </div>
           </div>
           
           <button 
             onClick={() => { setShowCredits(false); handleStartGameClick(); }}
             className="absolute bottom-8 px-6 py-2 border border-diesel-steel/20 hover:bg-white/10 text-xs text-diesel-steel uppercase tracking-widest z-20"
           >
             RESTART PROTOCOL
           </button>
        </div>
      );
    }

    // -- ACTOR PREVIEW --
    if (selection.type === 'actor' && displayData) {
      const actor = displayData as Actor;
      
      // Determine what to show: Selected SubID (Graphic) OR Cycle through graphics
      let displayImage = null;
      let displayInfo = null;

      if (selection.subId) {
         // Specific Graphic Selected
         const specificGraphic = actor.graphics?.find(g => g.id === selection.subId);
         if (specificGraphic) {
            displayImage = specificGraphic.image;
            displayInfo = specificGraphic;
         }
      } 
      
      if (!displayImage) {
         // Fallback to cycling behavior or default
         const hasGraphics = actor.graphics && actor.graphics.length > 0;
         const currentGraphic = hasGraphics ? actor.graphics[graphicIndex % actor.graphics.length] : null;
         displayImage = currentGraphic?.image || actor.image || actor.referenceImageCloseUp || actor.referenceImageFullBody || null;
         displayInfo = currentGraphic;
      }

      const hasGraphics = actor.graphics && actor.graphics.length > 0;

      const cycleGraphic = (e: React.MouseEvent, dir: number) => {
        e.stopPropagation(); // Prevent maximizing when clicking arrows
        if (!hasGraphics) return;
        setGraphicIndex(prev => {
           const next = prev + dir;
           if (next < 0) return actor.graphics.length - 1;
           return next;
        });
      };

      return (
        <div className="h-full border border-diesel-gold/50 bg-diesel-panel/80 p-4 relative flex flex-col shadow-diesel-glow">
          <div className="flex justify-between items-start border-b border-diesel-gold/30 pb-2 mb-4 shrink-0">
             <div>
               <h2 className="text-2xl font-bold text-diesel-gold uppercase font-sans">{actor.name}</h2>
             </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div 
              className={`flex-1 bg-black border border-diesel-border relative overflow-hidden group w-full cursor-zoom-in`}
              onClick={() => setIsMaximized(true)}
            >
              {displayImage ? (
                <img src={displayImage} className="w-full h-full object-contain" alt="character" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-diesel-steel font-mono text-4xl select-none">
                  NO_SIGNAL
                </div>
              )}
              
              {/* Overlay Controls for Library Browsing */}
              {hasGraphics && (
                 <div className="absolute bottom-0 inset-x-0 p-2 flex justify-between items-center bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => cycleGraphic(e, -1)} className="text-white hover:text-diesel-gold"><ChevronLeft size={20} /></button>
                    <div className="text-[10px] text-center text-diesel-gold font-mono">
                       {displayInfo && (
                          <>
                             <span className="block font-bold">{displayInfo.pose}</span>
                             <span className="opacity-70">{displayInfo.expression} / {displayInfo.angle}°</span>
                          </>
                       )}
                    </div>
                    <button onClick={(e) => cycleGraphic(e, 1)} className="text-white hover:text-diesel-gold"><ChevronRight size={20} /></button>
                 </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // -- ITEM PREVIEW --
    if (selection.type === 'item' && displayData) {
      const item = displayData as Item;
      return (
        <div className="h-full border border-diesel-gold/50 bg-diesel-panel/80 p-4 relative flex flex-col shadow-diesel-glow">
          <div className="flex justify-between items-start border-b border-diesel-gold/30 pb-2 mb-4 shrink-0">
             <div>
               <h2 className="text-2xl font-bold text-diesel-gold uppercase font-sans">{item.name}</h2>
               <div className="text-xs text-diesel-steel font-mono mt-1">
                 TYPE: {item.category.toUpperCase()} // {item.acquisition.toUpperCase()}
               </div>
             </div>
             <div className="bg-diesel-gold/20 p-2 rounded border border-diesel-gold">
               <Package className="text-diesel-gold" size={24} />
             </div>
          </div>
          <div className={`flex-1 bg-black border border-diesel-border p-4 flex flex-col gap-4 overflow-y-auto min-h-0`}>
             <div className="w-full aspect-square bg-[#080808] border border-diesel-border relative flex items-center justify-center overflow-hidden shrink-0">
                {item.visualAsset ? (
                   <img src={item.visualAsset} className="w-full h-full object-contain" />
                ) : (
                   <div className="text-diesel-steel text-[10px] text-center">NO VISUAL ASSET</div>
                )}
             </div>
          </div>
        </div>
      );
    }

    // -- SCENE PREVIEW (GAMEPLAY MODE) --
    if (selection.type === 'scene' && displayData) {
      const scene = displayData as Scene;
      const backgroundDrop = scene.dropId ? game.drops.find(s => s.id === scene.dropId) : null;
      
      const currentLineText = scriptLines[currentLineIndex] || "";
      const parsedLine = currentLineText.includes(':') 
         ? { name: currentLineText.split(':')[0], text: currentLineText.split(':')[1] }
         : { name: "", text: currentLineText };

      // High Contrast / Dyslexia Classes
      const textBaseClass = dyslexiaFont ? 'font-sans' : 'font-mono';
      const textSizeClass = textSize === 'huge' ? 'text-2xl' : textSize === 'large' ? 'text-lg' : 'text-sm';
      const containerClass = highContrast ? 'bg-black border-4 border-white' : 'bg-diesel-black/90 border border-diesel-gold/50 backdrop-blur-md';
      const textClass = highContrast ? 'text-white font-bold' : 'text-diesel-paper';
      const nameClass = highContrast ? 'text-yellow-400 font-bold uppercase' : 'text-diesel-gold font-bold uppercase tracking-widest';

      return (
        <div className="h-full border border-diesel-gold/50 bg-diesel-panel/80 relative flex flex-col shadow-diesel-glow overflow-hidden">
          
          {/* RUN MODE: SCENE RENDERER */}
          <div className={`flex-1 bg-black relative overflow-hidden group w-full`}>
            
            {/* Establishing Shot Overlay */}
            {isSimulating && showingEstablishingShot && scene.dropId ? (
               <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center cursor-pointer" onClick={() => setShowingEstablishingShot(false)}>
                   {(() => {
                      const drop = game.drops.find(s => s.id === scene.dropId);
                      return drop && drop.image ? (
                        <div className="relative w-full h-full animate-[fadeIn_2s_ease-out] flex flex-col items-center justify-center group">
                           <img src={drop.image} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Establishing Shot" />
                           <div className="relative z-10 flex flex-col items-center gap-4">
                               <div className="text-center animate-pulse mb-8">
                                  <span className="bg-black/80 text-white px-6 py-2 text-sm tracking-[0.5em] uppercase font-bold border-y-2 border-white/50 shadow-[0_0_20px_black]">
                                     {drop.name}
                                  </span>
                               </div>
                               
                               {/* BIG PLAY BUTTON OVERLAY */}
                               <button className="px-8 py-3 bg-diesel-gold text-black font-bold text-lg uppercase tracking-widest border-2 border-white shadow-[0_0_30px_rgba(203,169,109,0.5)] hover:scale-110 transition-transform">
                                  CLICK TO BEGIN SCENE
                               </button>
                           </div>
                        </div>
                      ) : (
                        <div className="text-white font-bold text-sm tracking-widest animate-pulse border border-white p-4 cursor-pointer hover:bg-white hover:text-black transition-colors">
                           NO SIGNAL - CLICK TO BYPASS
                        </div>
                      );
                   })()}
               </div>
            ) : null}

            {/* Background Drop Layer */}
            {backgroundDrop?.image && (
                <div className="absolute inset-0 z-0">
                    <img src={backgroundDrop.image} className="w-full h-full object-cover opacity-100" alt="background" />
                </div>
            )}

            {/* Stage Elements */}
            <div className={`absolute inset-0 z-0 ${highContrast ? 'grayscale contrast-150' : ''}`}>
               {scene.stage?.map(el => {
                  let imgSrc = null;
                  const sfxStyle = getSfxStyle(el); // APPLY SFX HERE

                  if (el.type === 'ACTOR') {
                     const actor = game.actors.find(a => a.id === el.assetId);
                     if (actor) {
                        if (el.pose && actor.graphics) {
                           const graphic = actor.graphics.find(g => g.pose === el.pose && (!el.expression || g.expression === el.expression));
                           if (graphic) imgSrc = graphic.image;
                        }
                        if (!imgSrc) imgSrc = actor.image || actor.referenceImageCloseUp;
                     }
                  } else if (el.type === 'ITEM') {
                     const item = game.items.find(i => i.id === el.assetId);
                     if (item) imgSrc = item.visualAsset;
                  }

                  return (
                     <div 
                        key={el.id}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                        style={{
                           left: `${el.x}%`,
                           top: `${el.y}%`,
                           zIndex: el.zIndex,
                           transform: `translate(-50%, -50%) scale(${el.scale}) rotate(${el.rotation}deg)`,
                           ...sfxStyle // INJECT STYLES
                        }}
                     >
                        {imgSrc && <img src={imgSrc} className="max-w-[300px] pointer-events-none drop-shadow-[0_0_5px_rgba(0,0,0,0.8)]" />}
                     </div>
                  );
               })}
            </div>

            {/* Accessibility: History Log Overlay */}
            {showHistory && (
               <div className="absolute inset-0 z-40 bg-diesel-black/95 p-8 overflow-y-auto animate-fade-in border-4 border-diesel-gold">
                  <div className="flex justify-between items-center mb-6">
                     <h2 className="text-xl font-bold text-diesel-gold uppercase">Dialogue History</h2>
                     <button onClick={() => setShowHistory(false)} className="text-white hover:text-diesel-rust"><Minimize size={24}/></button>
                  </div>
                  <div className="space-y-4">
                     {historyLog.map((entry, idx) => (
                        <div key={idx} className="border-b border-diesel-border pb-2">
                           <div className="text-diesel-gold text-xs font-bold mb-1">{entry.actor}</div>
                           <div className="text-diesel-paper text-sm">{entry.text}</div>
                        </div>
                     ))}
                     {historyLog.length === 0 && <div className="text-diesel-steel italic">No history yet.</div>}
                  </div>
               </div>
            )}

            {/* Accessibility: Sim Controls */}
            {isSimulating && (
               <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
                  <div className="flex gap-2">
                     <button 
                        onClick={() => setShowA11yMenu(!showA11yMenu)}
                        className="p-2 h-10 w-10 bg-black/50 hover:bg-white text-white hover:text-black rounded-full transition-all border border-white/20 flex items-center justify-center"
                        title="Accessibility Settings"
                     >
                        <Eye size={20} />
                     </button>
                     
                     <button 
                        onClick={() => setShowHistory(!showHistory)}
                        className="p-2 h-10 w-10 bg-black/50 hover:bg-white text-white hover:text-black rounded-full transition-all border border-white/20 flex items-center justify-center"
                        title="History Log"
                     >
                        <History size={20} />
                     </button>
                  </div>

                  {showA11yMenu && (
                     <div className="bg-black border border-white p-4 w-48 shadow-xl flex flex-col gap-3 rounded animate-fade-in">
                        <div>
                           <div className="text-[10px] uppercase text-gray-500 mb-1">Text Size</div>
                           <div className="flex gap-1">
                              <button onClick={() => setTextSize('normal')} className={`flex-1 text-xs border p-1 ${textSize === 'normal' ? 'bg-white text-black' : 'text-white'}`}>A</button>
                              <button onClick={() => setTextSize('large')} className={`flex-1 text-sm border p-1 ${textSize === 'large' ? 'bg-white text-black' : 'text-white'}`}>A+</button>
                              <button onClick={() => setTextSize('huge')} className={`flex-1 text-base border p-1 ${textSize === 'huge' ? 'bg-white text-black' : 'text-white'}`}>A++</button>
                           </div>
                        </div>
                        <div>
                           <div className="text-[10px] uppercase text-gray-500 mb-1">Display</div>
                           <button onClick={() => setHighContrast(!highContrast)} className={`w-full text-xs border p-1 mb-1 ${highContrast ? 'bg-yellow-400 text-black font-bold' : 'text-white'}`}>
                              High Contrast
                           </button>
                           <button onClick={() => setDyslexiaFont(!dyslexiaFont)} className={`w-full text-xs border p-1 font-sans ${dyslexiaFont ? 'bg-white text-black' : 'text-white'}`}>
                              Dyslexia Font
                           </button>
                        </div>
                     </div>
                  )}
               </div>
            )}

            {/* SCENE END MENU (SAVE / CONTINUE) */}
            {isSimulating && showSceneEndMenu && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="w-96 bg-diesel-panel border-2 border-diesel-gold p-6 shadow-diesel-glow flex flex-col gap-4">
                        <h3 className="text-xl font-bold text-diesel-gold text-center uppercase border-b border-diesel-gold/30 pb-4">
                            SCENE COMPLETE
                        </h3>
                        
                        {/* Next Scene Button (Logic to find next?) For now just restart logic or manual next */}
                        <button 
                           onClick={() => { setShowSceneEndMenu(false); /* Logic for next scene handled by GOTO usually, here we just close menu and assume user might pick next scene or restart */ }} 
                           className="py-3 bg-diesel-paper text-black font-bold hover:bg-white uppercase"
                        >
                            CONTINUE
                        </button>

                        <button 
                           onClick={() => { if(onSaveGame) onSaveGame(); }} 
                           className="py-3 bg-diesel-black text-diesel-green border border-diesel-green font-bold hover:bg-diesel-green hover:text-black uppercase flex items-center justify-center gap-2"
                        >
                            <Save size={16} /> SAVE PROTOCOL {game.info.enableAutosave && "(AUTO-SAVED)"}
                        </button>

                        <button 
                           onClick={handleEndSession}
                           className="py-3 bg-diesel-rust/20 text-diesel-rust border border-diesel-rust font-bold hover:bg-diesel-rust hover:text-black uppercase flex items-center justify-center gap-2"
                        >
                            <LogOut size={16} /> END SESSION
                        </button>
                    </div>
                </div>
            )}

            {/* RUN MODE: DIALOGUE BOX (VN Style) */}
            {isSimulating && !showSceneEndMenu && !showingEstablishingShot && (
               <div className="absolute bottom-0 inset-x-0 z-30 p-4 md:p-8 flex justify-center">
                  <div 
                     className={`w-full max-w-4xl ${containerClass} p-6 shadow-2xl relative min-h-[150px] flex flex-col cursor-pointer`}
                     onClick={handleNextLine}
                  >
                     {/* Name Tag */}
                     {parsedLine.name && (
                        <div className={`absolute -top-4 left-6 px-4 py-1 bg-diesel-black border border-diesel-gold shadow-lg ${nameClass} text-xs tracking-widest uppercase`}>
                           {parsedLine.name}
                        </div>
                     )}
                     
                     {/* Text Content */}
                     <div className={`${textBaseClass} ${textSizeClass} ${textClass} leading-relaxed`}>
                        {parsedLine.text || <span className="italic opacity-50">...</span>}
                     </div>

                     {/* Controls / Chevron */}
                     <div className="mt-auto flex justify-end items-center gap-4 pt-4 opacity-80 text-diesel-gold">
                        <span className="text-[10px] uppercase tracking-widest">Click to Continue</span>
                        <SkipForward className="animate-pulse" size={16} />
                     </div>
                  </div>
               </div>
            )}
            
            {/* EDIT MODE OVERLAY (When NOT Simulating) */}
            {!isSimulating && (
               <div className="absolute inset-0 p-4 font-mono text-sm text-gray-200 leading-relaxed whitespace-pre-wrap z-10 bg-black/80 backdrop-blur-sm pointer-events-none">
                   <div className="text-center mt-20 opacity-80 text-diesel-paper">
                      <p className="font-bold">VISUAL EDITOR MODE</p>
                      <p className="text-xs mt-2">Press RUN SIMULATION to test accessibility features.</p>
                   </div>
               </div>
            )}
          </div>
        </div>
      );
    }

    // -- DROP PREVIEW (Was Screen) --
    if (selection.type === 'drop' && displayData) {
      const drop = displayData as Drop;
      return (
        <div className="flex flex-col h-full border border-diesel-steel/50 bg-diesel-panel/80 p-0 shadow-xl group overflow-y-auto">
           {/* Header with actions */}
           <div className="p-4 border-b border-diesel-border mb-0 shrink-0 flex justify-between items-center bg-diesel-black/20">
              <div>
                <h2 className="text-xl font-bold text-diesel-paper uppercase font-sans">{drop.name}</h2>
              </div>
              <div className="flex gap-2">
                  <button 
                    onClick={() => setIsMaximized(true)}
                    className="p-2 text-diesel-paper hover:text-diesel-gold hover:bg-white/10 rounded disabled:opacity-50"
                  >
                    <Maximize size={18} />
                  </button>
              </div>
           </div>

           {/* 16:9 Image Container */}
           <div 
             className={`w-full aspect-video bg-black relative border-b border-diesel-border shadow-lg cursor-zoom-in group-hover:border-diesel-gold/50 transition-colors shrink-0`}
             onClick={() => drop.image && setIsMaximized(true)}
           >
             {drop.image ? (
                <img src={drop.image} alt={drop.name} className="w-full h-full object-cover" />
             ) : (
                <div className="absolute inset-0 flex items-center justify-center flex-col text-diesel-steel p-8 text-center border-y border-dashed border-diesel-border">
                   <p className="font-bold">NO VISUAL DATA</p>
                </div>
             )}
           </div>
        </div>
      );
    }

    return (
      <div className="h-full border border-diesel-border bg-diesel-black flex items-center justify-center text-diesel-steel">
        <div className="text-center">
          <p className="text-6xl font-mono mb-2 animate-pulse">∅</p>
          <p className="text-xs tracking-widest">NO_SIGNAL</p>
        </div>
      </div>
    );
  };
  
  if (isMaximized) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsMaximized(false)}>
        {currentVisualUrl ? (
          <img src={currentVisualUrl} className="max-w-full max-h-full object-contain shadow-2xl border border-diesel-gold" alt="Maximized View" />
        ) : (
          <div className="text-diesel-steel">NO SIGNAL</div>
        )}
        <button className="absolute top-4 right-4 text-white hover:text-diesel-rust"><Minimize size={32}/></button>
        <div className="absolute bottom-8 bg-black/50 text-white px-4 py-2 rounded-full text-xs font-mono border border-white/20">CLICK ANYWHERE TO CLOSE</div>
      </div>
    );
  }

  return renderVisual();
};