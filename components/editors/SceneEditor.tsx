import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Plus, Move, Layers, User, Mic, Play, Loader2, Monitor, ExternalLink, PlusCircle, StopCircle, Radio, MousePointer2, MoreVertical, RotateCw, Scale, Crosshair, Grid, Tag, Zap, RefreshCw, Download, Camera, MessageSquare, Cloud, MessageCircle, Sparkles, Check, Edit2, FileText, Music, Layout, Palette, ChevronRight, X, Image as ImageIcon, SkipForward } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Scene, GameData, StageElement, SelectionType, Actor, ActorGraphic, Drop, GameInfo } from '../../types';
import { POSES, EXPRESSIONS, ANGLES } from '../../constants';
import { speak, stopSpeech } from '../../utils/voice';

interface SceneEditorProps {
  game: GameData;
  scene: Scene;
  onUpdateScene: (id: string, updates: Partial<Scene>) => void;
  onDeleteScene: (id: string) => void;
  onUpdateActor: (id: string, updates: Partial<Actor>) => void;
  onAddDropForScene: (sceneId: string) => void;
  onUpdateDrop?: (id: string, updates: Partial<Drop>) => void;
  onSelect: (type: SelectionType, id: string | null) => void;
  onUpdateInfo?: (field: keyof GameInfo, value: any) => void;
  isSimulating?: boolean;
  voiceEnabled?: boolean;
}

export const SceneEditor: React.FC<SceneEditorProps> = ({
  game,
  scene,
  onUpdateScene,
  onDeleteScene,
  onUpdateActor,
  onAddDropForScene,
  onUpdateDrop,
  onSelect,
  onUpdateInfo,
  isSimulating,
  voiceEnabled
}) => {
  const [activeTab, setActiveTab] = useState<'script' | 'stage' | 'audio'>('stage');
  
  // Selection / Tools State
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'add-balloon'>('select');
  
  // Placement State (kept for right panel)
  const [selectedActorForPlacement, setSelectedActorForPlacement] = useState<string>(game.actors[0]?.id || "");
  const [selectedItemForPlacement, setSelectedItemForPlacement] = useState<string>(game.items[0]?.id || "");
  const [balloonText, setBalloonText] = useState("");
  const [balloonType, setBalloonType] = useState<'SPEECH' | 'THOUGHT'>('SPEECH');

  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Quick Gen State
  const [isQuickGenerating, setIsQuickGenerating] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, elementId: string } | null>(null);

  // -- EDITOR MODE TABS (Place vs Modify) --
  const [editorMode, setEditorMode] = useState<'place' | 'modify'>('place');

  // -- RUNNER STATE (Simulation) --
  const [scriptLines, setScriptLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [showingEstablishingShot, setShowingEstablishingShot] = useState(false);

  // Ensure placement ID is valid
  useEffect(() => {
     if (!selectedActorForPlacement && game.actors.length > 0) {
        setSelectedActorForPlacement(game.actors[0].id);
     }
     if (!selectedItemForPlacement && game.items.length > 0) {
        setSelectedItemForPlacement(game.items[0].id);
     }
  }, [game.actors, game.items]);

  // -- SIMULATION LOGIC --
  useEffect(() => {
    if (isSimulating) {
        // Initialize Sim
        if (scene.dropId) {
            setShowingEstablishingShot(true);
        } else {
            startScript();
        }
    } else {
        // Stop Sim
        if (audioElement) {
            audioElement.pause();
            setAudioElement(null);
        }
        stopSpeech();
        setShowingEstablishingShot(false);
    }
  }, [isSimulating, scene.id]);

  useEffect(() => {
      if (isSimulating && !showingEstablishingShot) {
          startScript();
      }
  }, [showingEstablishingShot, isSimulating]);

  // Auto-switch to MODIFY tab when an element is selected
  useEffect(() => {
     if (selectedElementId) {
        setEditorMode('modify');
     }
  }, [selectedElementId]);

  const handleModeSwitch = (mode: 'place' | 'modify') => {
     setEditorMode(mode);
     if (mode === 'place') {
        setSelectedElementId(null);
     }
  };

  const startScript = () => {
      if (scene.script) {
        const lines = scene.script.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('//'));
        setScriptLines(lines);
        setCurrentLineIndex(0);
        if(lines.length > 0) {
           playLineAudio(lines[0]);
        }
      } else {
        setScriptLines([]);
      }
  };

  const playLineAudio = (line: string) => {
    if (audioElement) audioElement.pause();
    
    // Ignore commands like >> GOTO
    if (line.startsWith('>>')) return;

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
    
    if (currentLineIndex < scriptLines.length - 1) {
      const nextIndex = currentLineIndex + 1;
      const nextLine = scriptLines[nextIndex];

      if (nextLine.trim().startsWith('>> GOTO:')) {
         const targetSceneName = nextLine.split('GOTO:')[1].trim();
         const targetScene = game.scenes.find(s => s.name === targetSceneName);
         if (targetScene && onSelect) {
            onSelect('scene', targetScene.id);
            return;
         }
      }

      setCurrentLineIndex(nextIndex);
      playLineAudio(nextLine);
    } else {
        // End of script
    }
  };

  // -- Visual Helpers --

  const getActorVisual = (element: StageElement): string | null => {
     const actor = game.actors.find(a => a.id === element.assetId);
     if (!actor) return null;
     
     if (element.pose && actor.graphics) {
        const targetAngle = element.spriteAngle || 0;
        const graphic = actor.graphics.find(g => 
            g.pose === element.pose && 
            (!element.expression || g.expression === element.expression) &&
            g.angle === targetAngle
        );
        if (graphic) return graphic.image;
        const fallback = actor.graphics.find(g => 
            g.pose === element.pose && 
            (!element.expression || g.expression === element.expression)
        );
        if (fallback) return fallback.image;
     }
     return actor.referenceImageFullBody || actor.image || actor.referenceImageCloseUp || null;
  };

  const getItemVisual = (element: StageElement): string | null => {
      const item = game.items.find(i => i.id === element.assetId);
      return item ? item.visualAsset : null;
  };

  const getSmartDefaults = (actorId: string) => {
    const actor = game.actors.find(a => a.id === actorId);
    let pose = 'Neutral';
    let expression = 'Neutral';
    if (actor && actor.graphics && actor.graphics.length > 0) {
        pose = actor.graphics[0].pose;
        expression = actor.graphics[0].expression;
    }
    return { pose, expression };
  };

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

  // -- Quick Generation Handler --
  const handleQuickGenerate = async (element: StageElement) => {
    if (!element || element.type !== 'ACTOR' || !process.env.API_KEY) return;
    const actor = game.actors.find(a => a.id === element.assetId);
    if (!actor) return;
    
    // Check references
    const referenceImage = actor.referenceImageFullBody || actor.referenceImageCloseUp;
    if (!referenceImage) {
        alert("Reference image missing. Please upload one in the Actor Editor.");
        return;
    }

    setIsQuickGenerating(true);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const parts: any[] = [];
        
        const meta = referenceImage.split(',')[0];
        const data = referenceImage.split(',')[1];
        const mimeType = meta.split(':')[1]?.split(';')[0];
        parts.push({ inlineData: { mimeType, data } });

        if (game.info.styleGuide) {
             const styleMeta = game.info.styleGuide.split(',')[0];
             const styleData = game.info.styleGuide.split(',')[1];
             const styleMime = styleMeta.split(':')[1]?.split(';')[0];
             parts.push({ inlineData: { mimeType: styleMime, data: styleData } });
        }

        const targetAngle = element.spriteAngle || 0;
        const pose = element.pose || 'Neutral';
        const expr = element.expression || 'Neutral';
        
        const prompt = `Generate a high-quality 2D game sprite. 
        Character Name: ${actor.name}.
        Pose: ${pose}.
        Expression: ${expr}.
        Camera Angle: ${targetAngle} degrees (Ensure head and body facing matches angle).
        Background: SOLID BRIGHT GREEN (#00FF00) for chroma key.
        Style: Flat colors, comic style outlines. Match the reference character exactly.`;

        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts }
        });

        const newImageBase64 = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        
        if (newImageBase64) {
            const finalImage = `data:image/png;base64,${newImageBase64}`;
            
            const img = new Image();
            img.src = finalImage;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
                    const d = imageData.data;
                    for(let i=0; i<d.length; i+=4) {
                        if(d[i+1] > d[i] + 20 && d[i+1] > d[i+2] + 20) d[i+3] = 0;
                    }
                    ctx.putImageData(imageData, 0, 0);
                    const processedImage = canvas.toDataURL();

                    const newGraphic: ActorGraphic = {
                        id: Date.now().toString(),
                        pose,
                        expression: expr,
                        angle: targetAngle,
                        image: processedImage
                    };
                    const updatedGraphics = [...(actor.graphics || []), newGraphic];
                    onUpdateActor(actor.id, { graphics: updatedGraphics });
                }
            };
        }
    } catch (e) {
        console.error("Quick Gen Failed", e);
        alert("Generation failed. Check console.");
    } finally {
        setIsQuickGenerating(false);
    }
  };


  // -- Interaction Handlers --

  const handleStageClick = (e: React.MouseEvent) => {
     if (e.target === stageRef.current) {
         setSelectedElementId(null);
     }
  };

  const handleStageBackgroundClick = (e: React.MouseEvent) => {
     if (!stageRef.current) return;
     
     if (activeTool === 'add-balloon' && balloonText && editorMode === 'place') {
         const rect = stageRef.current.getBoundingClientRect();
         const x = ((e.clientX - rect.left) / rect.width) * 100;
         const y = ((e.clientY - rect.top) / rect.height) * 100;
         
         const newElement: StageElement = {
            id: Date.now().toString(),
            assetId: 'balloon_' + Date.now(),
            type: 'BALLOON',
            x, y, scale: 1, zIndex: (scene.stage?.length || 0) + 100,
            rotation: 0, text: balloonText, balloonType
         };
         onUpdateScene(scene.id, { stage: [...(scene.stage || []), newElement] });
         setActiveTool('select');
         setBalloonText("");
         setSelectedElementId(newElement.id); // This will auto-switch to Modify mode
     } else {
         setSelectedElementId(null);
     }
  };

  const handleAddActor = () => {
      if (!selectedActorForPlacement) return;
      const { pose, expression } = getSmartDefaults(selectedActorForPlacement);
      const newElement: StageElement = {
        id: Date.now().toString(),
        assetId: selectedActorForPlacement,
        type: 'ACTOR',
        x: 50, y: 50, 
        scale: 1, zIndex: (scene.stage?.length || 0) + 1,
        rotation: 0, pose, expression, spriteAngle: 0, activeSfx: []
      };
      onUpdateScene(scene.id, { stage: [...(scene.stage || []), newElement] });
      setSelectedElementId(newElement.id); // This will auto-switch to Modify mode
  };

  const handleAddItem = () => {
      if (!selectedItemForPlacement) return;
      const newElement: StageElement = {
        id: Date.now().toString(),
        assetId: selectedItemForPlacement,
        type: 'ITEM',
        x: 50, y: 50,
        scale: 1, zIndex: (scene.stage?.length || 0) + 1,
        rotation: 0, activeSfx: []
      };
      onUpdateScene(scene.id, { stage: [...(scene.stage || []), newElement] });
      setSelectedElementId(newElement.id); // This will auto-switch to Modify mode
  };

  const handleElementMouseDown = (e: React.MouseEvent, elId: string) => {
     if (e.button === 0 && !isSimulating) {
        e.stopPropagation();
        setSelectedElementId(elId);
        setDraggedElementId(elId);
     }
  };

  const handleContextMenu = (e: React.MouseEvent, elId: string) => {
    if (isSimulating) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, elementId: elId });
  };

  const closeContextMenu = () => setContextMenu(null);

  useEffect(() => {
     const handleMouseMove = (e: MouseEvent) => {
        if (draggedElementId && stageRef.current) {
           const rect = stageRef.current.getBoundingClientRect();
           let x = ((e.clientX - rect.left) / rect.width) * 100;
           let y = ((e.clientY - rect.top) / rect.height) * 100;
           x = Math.max(0, Math.min(100, x));
           y = Math.max(0, Math.min(100, y));
           
           const updatedStage = scene.stage?.map(el => 
              el.id === draggedElementId ? { ...el, x, y } : el
           );
           onUpdateScene(scene.id, { stage: updatedStage });
        }
     };
     const handleMouseUp = () => { setDraggedElementId(null); };
     if (draggedElementId) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
     }
     return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
     };
  }, [draggedElementId, scene.stage, onUpdateScene, scene.id]);

  const handleUpdateElement = (elId: string, updates: Partial<StageElement>) => {
    const updatedStage = scene.stage?.map(el => 
      el.id === elId ? { ...el, ...updates } : el
    );
    onUpdateScene(scene.id, { stage: updatedStage });
  };

  const handleDeleteElement = (elId: string) => {
    const updatedStage = scene.stage?.filter(el => el.id !== elId);
    onUpdateScene(scene.id, { stage: updatedStage });
    setSelectedElementId(null);
  };

  const handleToggleSfx = (elId: string, sfxId: string) => {
      const element = scene.stage?.find(el => el.id === elId);
      if (!element) return;
      const currentSfx = element.activeSfx || [];
      const newSfx = currentSfx.includes(sfxId)
          ? currentSfx.filter(id => id !== sfxId) 
          : [...currentSfx, sfxId]; 
      handleUpdateElement(elId, { activeSfx: newSfx });
  };

  // -- Render Data --
  const backgroundDrop = game.drops.find(s => s.id === scene.dropId);
  const selectedElement = scene.stage?.find(el => el.id === selectedElementId);
  const contextElement = contextMenu ? scene.stage?.find(el => el.id === contextMenu.elementId) : null;

  // -- Dialogue Parsing for Sim --
  const currentLineText = scriptLines[currentLineIndex] || "";
  const parsedLine = currentLineText.includes(':') 
     ? { name: currentLineText.split(':')[0], text: currentLineText.split(':')[1] }
     : { name: "", text: currentLineText };

  return (
    <div className="h-full flex flex-col">
      {/* TABS HEADER */}
      <div className="flex bg-diesel-black border-b border-diesel-border text-xs font-bold shrink-0">
          <button 
             onClick={() => setActiveTab('stage')} 
             className={`flex-1 py-3 flex items-center justify-center gap-2 border-r border-diesel-border transition-colors uppercase ${activeTab === 'stage' ? 'bg-diesel-panel text-diesel-gold border-b-2 border-b-diesel-gold' : 'text-diesel-steel hover:text-white hover:bg-white/5'}`}
          >
             <Layout size={14} /> VISUAL STAGE
          </button>
          <button 
             onClick={() => setActiveTab('script')} 
             className={`flex-1 py-3 flex items-center justify-center gap-2 border-r border-diesel-border transition-colors uppercase ${activeTab === 'script' ? 'bg-diesel-panel text-diesel-paper border-b-2 border-b-diesel-paper' : 'text-diesel-steel hover:text-white hover:bg-white/5'}`}
          >
             <FileText size={14} /> DRAMSCRIPT
          </button>
          <button 
             onClick={() => setActiveTab('audio')} 
             className={`flex-1 py-3 flex items-center justify-center gap-2 transition-colors uppercase ${activeTab === 'audio' ? 'bg-diesel-panel text-diesel-green border-b-2 border-b-diesel-green' : 'text-diesel-steel hover:text-white hover:bg-white/5'}`}
          >
             <Music size={14} /> AUDIO LOG
          </button>
      </div>
      
      {activeTab === 'stage' ? (
        <div className="flex-1 flex overflow-hidden">
           
           {/* LEFT COLUMN: STAGE (FULL WIDTH IF SIMULATING) */}
           <div className="flex-1 bg-[#050505] relative flex flex-col items-center justify-center p-8 border-r border-diesel-border overflow-hidden">
              
              {/* TOP TOOLBAR */}
              {!isSimulating && (
                <div className="absolute top-0 left-0 right-0 bg-diesel-dark border-b border-diesel-border p-2 flex justify-between items-center z-20">
                    <div className="flex items-center gap-2">
                        <input 
                            className="bg-black text-diesel-rust font-bold uppercase text-xs p-1.5 border border-diesel-border focus:border-diesel-rust outline-none w-48"
                            value={scene.name}
                            onChange={(e) => onUpdateScene(scene.id, { name: e.target.value })}
                            placeholder="SCENE NAME"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <select 
                            className="bg-black text-diesel-paper text-xs p-1.5 border border-diesel-border focus:border-diesel-paper outline-none max-w-[200px]"
                            value={scene.dropId || ""}
                            onChange={(e) => onUpdateScene(scene.id, { dropId: e.target.value || undefined })}
                        >
                            <option value="">(No Backdrop)</option>
                            {game.drops.map(s => (
                            <option key={s.id} value={s.id}>
                               {s.name.length > 30 ? s.name.substring(0, 30) + "..." : s.name}
                            </option>
                            ))}
                        </select>
                        <button 
                            onClick={() => onAddDropForScene(scene.id)}
                            className="flex items-center gap-1 px-2 py-1.5 bg-diesel-paper/10 text-diesel-paper text-[10px] font-bold border border-diesel-paper hover:bg-diesel-paper hover:text-black transition-colors"
                        >
                            <Plus size={10} /> NEW DROP
                        </button>
                    </div>
                </div>
              )}

              {/* 16:9 STAGE CONTAINER */}
              <div 
                 ref={stageRef}
                 onClick={isSimulating ? handleNextLine : handleStageBackgroundClick}
                 className={`relative w-full aspect-video bg-[#0a0a0a] shadow-2xl border border-diesel-border/50 overflow-hidden ${activeTool === 'add-balloon' && editorMode === 'place' ? 'cursor-crosshair' : ''} ${isSimulating ? 'cursor-pointer' : ''}`}
                 style={{ maxHeight: 'calc(100% - 60px)', maxWidth: '100%' }}
              >
                  {/* Establishing Shot Overlay */}
                  {isSimulating && showingEstablishingShot && backgroundDrop?.image && (
                      <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowingEstablishingShot(false); }}>
                        <div className="relative w-full h-full animate-[fadeIn_1s_ease-out] group">
                           <img src={backgroundDrop.image} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Establishing Shot" />
                           <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-4 z-10">
                               <div className="text-center animate-pulse mb-4">
                                  <span className="bg-black/80 text-white px-6 py-2 text-sm tracking-[0.5em] uppercase font-bold border-y-2 border-white/50 shadow-2xl">
                                     {backgroundDrop.name}
                                  </span>
                               </div>
                               <div className="px-6 py-2 bg-diesel-gold text-black font-bold text-xs uppercase tracking-widest border-2 border-white shadow-xl animate-bounce">
                                  CLICK TO BEGIN SCENE
                               </div>
                           </div>
                        </div>
                      </div>
                  )}

                  {backgroundDrop?.image ? (
                      <div className="absolute inset-0 pointer-events-none">
                        <img src={backgroundDrop.image} className="w-full h-full object-cover" alt="bg" />
                      </div>
                  ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-diesel-steel/10 text-6xl font-bold font-mono pointer-events-none select-none">NO SIGNAL</div>
                  )}

                  {scene.stage?.map(el => {
                     const isSelected = selectedElementId === el.id;
                     const sfxStyle = getSfxStyle(el);

                     return (
                        <div
                            key={el.id}
                            onMouseDown={(e) => handleElementMouseDown(e, el.id)}
                            onClick={(e) => e.stopPropagation()}
                            onContextMenu={(e) => handleContextMenu(e, el.id)}
                            className={`absolute origin-center transition-transform duration-300
                                ${isSelected && !isSimulating ? 'ring-2 ring-diesel-gold z-50 cursor-move' : ''}
                                ${isSimulating ? '' : 'cursor-pointer hover:brightness-110'}
                            `}
                            style={{
                                left: `${el.x}%`,
                                top: `${el.y}%`,
                                width: el.type === 'ITEM' ? `${10 * el.scale}%` : (el.type === 'ACTOR' ? `${20 * el.scale}%` : 'auto'),
                                transform: `translate(-50%, -50%) rotate(${el.rotation}deg) scale(${el.type === 'BALLOON' ? el.scale : 1})`,
                                zIndex: el.zIndex,
                                ...sfxStyle
                            }}
                        >
                            {el.type === 'ACTOR' && (
                                <img 
                                  src={getActorVisual(el) || ""} 
                                  className="w-full drop-shadow-2xl pointer-events-none select-none" 
                                  style={{ mixBlendMode: 'normal' }} 
                                />
                            )}
                            {el.type === 'ITEM' && (
                                <img src={getItemVisual(el) || ""} className="w-full drop-shadow-xl pointer-events-none select-none" />
                            )}
                            {el.type === 'BALLOON' && (
                                <div className={`
                                    bg-[#f3f4f6] text-black font-bold font-mono text-lg px-4 py-4 max-w-[250px] text-center shadow-xl border-2 border-black leading-tight relative select-none
                                    ${el.balloonType === 'THOUGHT' ? 'rounded-[2rem] border-dashed' : 'rounded-xl rounded-bl-none'}
                                `}>
                                    {el.text}
                                    {/* Speech Tail */}
                                    {(!el.balloonType || el.balloonType === 'SPEECH') && (
                                        <div className="absolute -bottom-[8px] left-[0px] w-0 h-0 border-l-[12px] border-l-transparent border-t-[12px] border-t-black border-r-[0px] border-r-transparent">
                                            <div className="absolute -top-[14px] left-[-10px] w-0 h-0 border-l-[10px] border-l-transparent border-t-[10px] border-t-[#f3f4f6] border-r-[0px] border-r-transparent"></div>
                                        </div>
                                    )}
                                    {/* Thought Bubbles */}
                                    {el.balloonType === 'THOUGHT' && (
                                        <>
                                            <div className="absolute -bottom-3 left-4 w-3 h-3 bg-[#f3f4f6] border-2 border-black rounded-full"></div>
                                            <div className="absolute -bottom-6 left-2 w-2 h-2 bg-[#f3f4f6] border-2 border-black rounded-full"></div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                     );
                  })}

                  {/* SIMULATION: DIALOGUE OVERLAY */}
                  {isSimulating && !showingEstablishingShot && (
                      <div className="absolute bottom-4 left-4 right-4 z-40">
                          <div className="bg-diesel-black/90 border border-diesel-gold/50 backdrop-blur-md p-6 shadow-2xl relative min-h-[120px] flex flex-col">
                                {/* Name Tag */}
                                {parsedLine.name && (
                                    <div className="absolute -top-3 left-6 px-4 py-1 bg-diesel-black border border-diesel-gold text-diesel-gold font-bold text-xs tracking-widest uppercase shadow-lg">
                                        {parsedLine.name}
                                    </div>
                                )}
                                {/* Text */}
                                <div className="text-diesel-paper font-mono text-lg leading-relaxed">
                                    {parsedLine.text || <span className="italic opacity-50">...</span>}
                                </div>
                                <div className="mt-auto flex justify-end">
                                    <SkipForward className="text-diesel-gold animate-pulse" size={20} />
                                </div>
                          </div>
                      </div>
                  )}
              </div>
           </div>

           {/* RIGHT COLUMN: INSPECTOR & TOOLS (HIDDEN DURING SIM) */}
           {!isSimulating && (
               <div className="w-72 bg-diesel-panel border-l border-diesel-border flex flex-col shrink-0 relative z-30 shadow-xl transition-all duration-300">
                  
                  {/* EDITOR MODE TABS */}
                  <div className="flex bg-diesel-black border-b border-diesel-border">
                      <button 
                         onClick={() => handleModeSwitch('place')} 
                         className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition-colors ${editorMode === 'place' ? 'bg-diesel-gold text-black' : 'text-diesel-steel hover:bg-white/5'}`}
                      >
                         <Plus size={12} /> PLACE
                      </button>
                      <button 
                         onClick={() => handleModeSwitch('modify')} 
                         className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition-colors ${editorMode === 'modify' ? 'bg-diesel-green text-black' : 'text-diesel-steel hover:bg-white/5'}`}
                      >
                         <MousePointer2 size={12} /> MODIFY
                      </button>
                  </div>

                  <div className="p-3 bg-diesel-black border-b border-diesel-border">
                     <h3 className="text-xs font-bold text-diesel-gold uppercase tracking-widest flex items-center gap-2">
                        {editorMode === 'place' ? <PlusCircle size={14}/> : <Edit2 size={14}/>}
                        {editorMode === 'place' ? "SCENE TOOLS" : "INSPECTOR"}
                     </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
                     
                     {/* MODE: PLACE */}
                     {editorMode === 'place' && (
                        <div className="animate-fade-in space-y-3">
                           {/* Add Actor */}
                           <div className="bg-diesel-dark p-3 border border-diesel-border">
                              <div className="text-[10px] text-diesel-steel uppercase font-bold mb-2 flex items-center gap-1"><User size={12}/> Actor</div>
                              <select 
                                  className="w-full bg-diesel-black text-diesel-gold text-xs font-bold border border-diesel-border p-2 mb-2 focus:outline-none"
                                  value={selectedActorForPlacement}
                                  onChange={(e) => setSelectedActorForPlacement(e.target.value)}
                              >
                                  {game.actors.length > 0 ? (game.actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)) : (<option value="">No Actors</option>)}
                              </select>
                              <button onClick={handleAddActor} disabled={game.actors.length === 0} className="w-full bg-diesel-gold text-black text-xs font-bold py-2 hover:bg-white transition-colors">
                                 ADD TO CENTER
                              </button>
                           </div>

                           {/* Add Item */}
                           <div className="bg-diesel-dark p-3 border border-diesel-border">
                              <div className="text-[10px] text-diesel-steel uppercase font-bold mb-2 flex items-center gap-1"><Tag size={12}/> Item</div>
                              <select 
                                  className="w-full bg-diesel-black text-diesel-green text-xs font-bold border border-diesel-border p-2 mb-2 focus:outline-none"
                                  value={selectedItemForPlacement}
                                  onChange={(e) => setSelectedItemForPlacement(e.target.value)}
                              >
                                  {game.items.length > 0 ? (game.items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)) : (<option value="">No Items</option>)}
                              </select>
                              <button onClick={handleAddItem} disabled={game.items.length === 0} className="w-full bg-diesel-green text-black text-xs font-bold py-2 hover:bg-white transition-colors">
                                 ADD TO CENTER
                              </button>
                           </div>

                           {/* Add Balloon */}
                           <div className="bg-diesel-dark p-3 border border-diesel-border">
                              <div className="text-[10px] text-diesel-steel uppercase font-bold mb-2 flex items-center gap-1"><MessageSquare size={12}/> Text Balloon</div>
                              <div className="flex gap-1 mb-2">
                                 <button onClick={() => setBalloonType('SPEECH')} className={`flex-1 py-1 text-[10px] border ${balloonType === 'SPEECH' ? 'bg-white text-black border-white' : 'text-diesel-steel border-diesel-border'}`}>SPEECH</button>
                                 <button onClick={() => setBalloonType('THOUGHT')} className={`flex-1 py-1 text-[10px] border ${balloonType === 'THOUGHT' ? 'bg-white text-black border-white' : 'text-diesel-steel border-diesel-border'}`}>THOUGHT</button>
                              </div>
                              <textarea 
                                 className="w-full bg-diesel-black text-white text-xs border border-diesel-border p-2 mb-2 h-16 resize-none focus:border-diesel-gold outline-none"
                                 placeholder="Dialogue text..."
                                 value={balloonText}
                                 onChange={(e) => setBalloonText(e.target.value)}
                              />
                              <button 
                                 onClick={() => setActiveTool(activeTool === 'add-balloon' ? 'select' : 'add-balloon')} 
                                 disabled={!balloonText}
                                 className={`w-full text-xs font-bold py-2 transition-colors border ${activeTool === 'add-balloon' ? 'bg-diesel-rust text-black border-diesel-rust animate-pulse' : 'bg-diesel-paper text-black hover:bg-white border-diesel-paper disabled:opacity-50'}`}
                              >
                                 {activeTool === 'add-balloon' ? 'CLICK STAGE TO PLACE' : 'PLACE ON STAGE'}
                              </button>
                           </div>
                        </div>
                     )}

                     {/* MODE: MODIFY (INSPECTOR) */}
                     {editorMode === 'modify' && (
                        <div className="animate-fade-in space-y-4">
                           {selectedElement ? (
                               <>
                                   <div className="flex justify-between items-center pb-2 border-b border-diesel-gold/20">
                                      <span className="text-xs font-bold text-diesel-gold">
                                         {selectedElement.type} PROPERTIES
                                      </span>
                                      <button onClick={() => setSelectedElementId(null)} className="text-diesel-steel hover:text-white"><X size={14}/></button>
                                   </div>

                                   {/* TRANSFORM */}
                                   <div className="space-y-2">
                                      <div className="text-[9px] text-diesel-steel uppercase font-bold">Transform</div>
                                      <div className="flex items-center justify-between">
                                         <Scale size={12} className="text-diesel-steel mr-2"/>
                                         <input type="range" min="0.5" max="3" step="0.1" value={selectedElement.scale} onChange={(e) => handleUpdateElement(selectedElement.id, { scale: Number(e.target.value) })} className="flex-1 h-1 bg-diesel-black appearance-none accent-diesel-gold"/>
                                      </div>
                                      <div className="flex items-center justify-between">
                                         <RotateCw size={12} className="text-diesel-steel mr-2"/>
                                         <input type="range" min="-180" max="180" value={selectedElement.rotation} onChange={(e) => handleUpdateElement(selectedElement.id, { rotation: Number(e.target.value) })} className="flex-1 h-1 bg-diesel-black appearance-none accent-diesel-gold"/>
                                      </div>
                                      <div className="flex items-center justify-between">
                                         <Layers size={12} className="text-diesel-steel mr-2"/>
                                         <input type="number" className="w-16 bg-diesel-black text-right text-xs p-1 border border-diesel-border text-white" value={selectedElement.zIndex} onChange={(e) => handleUpdateElement(selectedElement.id, { zIndex: Number(e.target.value) })}/>
                                      </div>
                                   </div>

                                   {/* BALLOON SPECIFIC */}
                                   {selectedElement.type === 'BALLOON' && (
                                      <div className="space-y-2 border-t border-diesel-gold/20 pt-2">
                                         <div className="text-[9px] text-diesel-steel uppercase font-bold">Balloon Content</div>
                                         <textarea 
                                            className="w-full bg-diesel-black text-white text-xs border border-diesel-border p-2 focus:outline-none focus:border-diesel-gold h-20 resize-none"
                                            value={selectedElement.text || ""}
                                            onChange={(e) => handleUpdateElement(selectedElement.id, { text: e.target.value })}
                                         />
                                         <div className="flex gap-1">
                                            <button 
                                               onClick={() => handleUpdateElement(selectedElement.id, { balloonType: 'SPEECH' })} 
                                               className={`flex-1 py-1 text-[10px] border ${(!selectedElement.balloonType || selectedElement.balloonType === 'SPEECH') ? 'bg-white text-black border-white' : 'text-diesel-steel border-diesel-border'}`}
                                            >
                                               SPEECH
                                            </button>
                                            <button 
                                               onClick={() => handleUpdateElement(selectedElement.id, { balloonType: 'THOUGHT' })} 
                                               className={`flex-1 py-1 text-[10px] border ${selectedElement.balloonType === 'THOUGHT' ? 'bg-white text-black border-white' : 'text-diesel-steel border-diesel-border'}`}
                                            >
                                               THOUGHT
                                            </button>
                                         </div>
                                      </div>
                                   )}

                                   {/* ACTOR SPECIFIC */}
                                   {selectedElement.type === 'ACTOR' && (
                                      <div className="space-y-2 border-t border-diesel-gold/20 pt-2">
                                         <div className="text-[9px] text-diesel-steel uppercase font-bold flex justify-between items-center">
                                             State
                                             <button 
                                                onClick={() => onSelect('actor', selectedElement.assetId)}
                                                className="flex items-center gap-1 text-[8px] bg-diesel-gold/10 text-diesel-gold px-1.5 py-0.5 border border-diesel-gold/30 hover:bg-diesel-gold hover:text-black transition-colors"
                                             >
                                                <Zap size={8} /> OPEN IN LAB
                                             </button>
                                         </div>
                                         
                                         <div className="grid grid-cols-2 gap-2">
                                            <div>
                                               <label className="text-[8px] text-diesel-steel block mb-1">Pose</label>
                                               <select className="w-full bg-diesel-black text-[9px] text-white border border-diesel-border p-1" value={selectedElement.pose} onChange={(e) => handleUpdateElement(selectedElement.id, { pose: e.target.value })}>
                                                  {POSES.map(p => <option key={p} value={p}>{p}</option>)}
                                               </select>
                                            </div>
                                            <div>
                                               <label className="text-[8px] text-diesel-steel block mb-1">Expression</label>
                                               <select className="w-full bg-diesel-black text-[9px] text-white border border-diesel-border p-1" value={selectedElement.expression} onChange={(e) => handleUpdateElement(selectedElement.id, { expression: e.target.value })}>
                                                  {EXPRESSIONS.map(e => <option key={e} value={e}>{e}</option>)}
                                               </select>
                                            </div>
                                         </div>
                                         
                                         {/* ANGLE SELECTOR */}
                                         <div>
                                            <label className="text-[8px] text-diesel-steel block mb-1">Camera Angle (Sprite)</label>
                                            <select 
                                                className="w-full bg-diesel-black text-[9px] text-diesel-gold border border-diesel-border p-1 font-bold"
                                                value={selectedElement.spriteAngle || 0}
                                                onChange={(e) => handleUpdateElement(selectedElement.id, { spriteAngle: Number(e.target.value) })}
                                            >
                                               {ANGLES.map(a => <option key={a} value={a}>{a}° View</option>)}
                                            </select>
                                         </div>

                                         {/* QUICK GENERATOR */}
                                         <button 
                                            onClick={() => handleQuickGenerate(selectedElement)}
                                            disabled={isQuickGenerating}
                                            className="w-full py-1.5 bg-diesel-gold/10 text-diesel-gold border border-diesel-gold/50 hover:bg-diesel-gold hover:text-black text-[9px] font-bold flex items-center justify-center gap-2 mt-2"
                                         >
                                            {isQuickGenerating ? <RefreshCw size={10} className="animate-spin" /> : <Zap size={10} />}
                                            GENERATE MISSING SPRITE
                                         </button>
                                      </div>
                                   )}

                                   {/* SFX */}
                                   <div className="border-t border-diesel-gold/20 pt-2">
                                      <div className="text-[9px] text-diesel-steel uppercase font-bold mb-2 flex items-center gap-1">
                                          <Sparkles size={10} /> Active Effects
                                      </div>
                                      <div className="max-h-40 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                                          {game.sfx.map(sfx => {
                                              const isActive = selectedElement.activeSfx?.includes(sfx.id);
                                              return (
                                                  <button 
                                                    key={sfx.id}
                                                    onClick={() => handleToggleSfx(selectedElement.id, sfx.id)}
                                                    className={`text-[10px] text-left px-2 py-1 flex items-center justify-between border ${isActive ? 'bg-diesel-green text-black border-diesel-green font-bold' : 'bg-black text-diesel-steel border-diesel-border hover:bg-white/10'}`}
                                                  >
                                                      <span className="truncate">{sfx.name}</span>
                                                      {isActive && <Check size={10}/>}
                                                  </button>
                                              );
                                          })}
                                          {game.sfx.length === 0 && <div className="text-[9px] text-diesel-steel italic">No effects created yet.</div>}
                                      </div>
                                   </div>

                                   <div className="pt-4 border-t border-diesel-border">
                                      <button onClick={() => handleDeleteElement(selectedElement.id)} className="w-full bg-diesel-rust text-black text-xs font-bold py-2 hover:bg-white flex items-center justify-center gap-2">
                                         <Trash2 size={14}/> DELETE ELEMENT
                                      </button>
                                   </div>
                               </>
                           ) : (
                               <div className="flex flex-col items-center justify-center text-diesel-steel opacity-50 h-64 gap-2">
                                   <Crosshair size={32} />
                                   <p className="text-xs text-center">SELECT ELEMENT ON STAGE<br/>TO MODIFY</p>
                               </div>
                           )}
                        </div>
                     )}

                  </div>
               </div>
           )}
        </div>
      ) : activeTab === 'script' ? (
         <div className="flex-1 p-6 flex flex-col h-full overflow-hidden">
             <div className="flex justify-between items-center mb-4 border-b border-diesel-paper/30 pb-2 shrink-0">
                <h3 className="text-xl font-bold text-diesel-paper uppercase flex items-center gap-2">
                   <FileText size={20} className="text-diesel-gold" /> DRAMSCRIPT EDITOR
                </h3>
             </div>
             
             <div className="bg-black/50 p-2 border border-diesel-border mb-4 text-[10px] font-mono text-diesel-steel">
                <span className="text-diesel-gold font-bold">SYNTAX GUIDE:</span><br/>
                Actor Name: "Dialogue text"<br/>
                >> GOTO: Scene Name<br/>
                // Comments ignored by engine
             </div>

             <textarea 
                className="flex-1 w-full bg-diesel-black border border-diesel-border p-4 font-mono text-sm text-diesel-paper focus:outline-none focus:border-diesel-gold resize-none leading-relaxed"
                placeholder="// Enter dialogue here..."
                value={scene.script}
                onChange={(e) => onUpdateScene(scene.id, { script: e.target.value })}
                spellCheck={false}
             />
         </div>
      ) : (
         <div className="flex-1 p-6 flex flex-col items-center justify-center text-diesel-steel opacity-50">
             <Music size={48} className="mb-4" />
             <p>AUDIO MANAGER (COMING SOON)</p>
         </div>
      )}
    </div>
  );
};