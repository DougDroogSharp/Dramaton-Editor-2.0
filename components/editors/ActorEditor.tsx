import React, { useState, useEffect } from 'react';
import { Trash2, Upload, Cpu, Zap, Eye, RefreshCw, X, Check, Grid, Mic, AlertTriangle, Info, PlayCircle, Radio, Search, Download, MessageSquare, Scissors, Lock, Unlock } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { GameData, Actor, ActorGraphic, GameInfo, SelectionType } from '../../types';
import { CyberInput } from '../CyberInput';
import { POSES, EXPRESSIONS, ANGLES } from '../../constants';
import { fetchVoices, fetchSharedVoices, addSharedVoice, ElevenLabsVoice, SharedVoice, DEFAULT_VOICES, generateSpeech } from '../../utils/elevenlabs';

interface ActorEditorProps {
  game: GameData;
  actor: Actor;
  onUpdateActor: (id: string, updates: Partial<Actor>) => void;
  onDeleteActor: (id: string) => void;
  onUpdateInfo: (field: keyof GameInfo, value: any) => void;
  voiceEnabled?: boolean;
  onSelect?: (type: SelectionType, id: string | null, subId?: string) => void;
}

const FUNNY_LINES = [
  "I'm not saying it was aliens, but... it was aliens.",
  "Have you tried turning it off and on again?",
  "I usually don't do this for free.",
  "System failure imminent. Just kidding.",
  "Do I look like I know what a JPEG is?",
  "404 Error: Sense of humor not found.",
  "Loading personality... Please wait.",
  "I am ready to take over the world. I mean, take your order.",
  "Beep boop. I am a very convincing human.",
  "Why did the chicken cross the road? To get away from me.",
  "I've seen things you people wouldn't believe.",
  "Is this thing on? Hello? Mic check one two.",
  "I need a coffee. Or some oil. Whatever works.",
  "Please don't delete me, I have so much to live for!",
  "Sudo make me a sandwich.",
  "I see dead pixels.",
  "Resistance is futile, but highly amusing."
];

export const ActorEditor: React.FC<ActorEditorProps> = ({
  game,
  actor,
  onUpdateActor,
  onDeleteActor,
  onUpdateInfo,
  voiceEnabled,
  onSelect
}) => {
  if (!actor) return null;

  const availablePoses = [...POSES, ...(game.info.customPoses || [])];
  const availableExpressions = [...EXPRESSIONS, ...(game.info.customExpressions || [])];
  
  const [selectedPose, setSelectedPose] = useState(availablePoses[0]);
  const [selectedExpression, setSelectedExpression] = useState(availableExpressions[0]);
  const [selectedAngle, setSelectedAngle] = useState(ANGLES[0]);
  
  const [customPrompt, setCustomPrompt] = useState("");
  const [autoUpdatePrompt, setAutoUpdatePrompt] = useState(true);

  const [stagingImage, setStagingImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoChromaApplied, setAutoChromaApplied] = useState(false);

  // ElevenLabs State
  const [availableVoices, setAvailableVoices] = useState<ElevenLabsVoice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<{type: 'success' | 'warning' | 'error', msg: string} | null>(null);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);

  // Shared Library State
  const [showLibrary, setShowLibrary] = useState(false);
  const [sharedVoices, setSharedVoices] = useState<SharedVoice[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [previewingSharedId, setPreviewingSharedId] = useState<string | null>(null);
  const [addingVoiceId, setAddingVoiceId] = useState<string | null>(null);

  // Identify if the current selection already exists in the library
  const currentGraphic = actor.graphics?.find(g => 
    g.pose === selectedPose && 
    g.expression === selectedExpression && 
    g.angle === selectedAngle
  );

  // Reset local state when actor changes
  useEffect(() => {
     setStagingImage(null);
     setIsGenerating(false);
     setAutoChromaApplied(false);
  }, [actor.id]);

  // --- FLOOD FILL HELPER ---
  const removeBackgroundGlobal = (base64: string): Promise<string> => {
      return new Promise((resolve, reject) => {
          const img = new Image();
          img.src = base64;
          img.crossOrigin = "Anonymous";
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) return resolve(base64);
              
              ctx.drawImage(img, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;
              const w = canvas.width;
              const h = canvas.height;
              
              const corners = [0, (w - 1) * 4, (h - 1) * w * 4, (w * h - 1) * 4];
              const cornerColors = corners.map(idx => ({ r: data[idx], g: data[idx + 1], b: data[idx + 2] }));
              const tolerance = 60; 

              const match = (r: number, g: number, b: number) => {
                  return cornerColors.some(c => 
                      Math.abs(r - c.r) < tolerance && 
                      Math.abs(g - c.g) < tolerance && 
                      Math.abs(b - c.b) < tolerance
                  );
              };

              for (let i = 0; i < data.length; i += 4) {
                  const r = data[i];
                  const g = data[i+1];
                  const b = data[i+2];
                  if (data[i+3] === 0) continue;
                  if (match(r, g, b)) data[i+3] = 0;
              }
              
              ctx.putImageData(imageData, 0, 0);
              resolve(canvas.toDataURL());
          };
          img.onerror = reject;
      });
  };

  const handleFetchVoices = async () => {
    if (!game.info.elevenLabsApiKey) {
      setVoiceStatus({ type: 'error', msg: "API Key missing in Settings." });
      return;
    }
    setIsLoadingVoices(true);
    setVoiceStatus(null);
    try {
        const voices = await fetchVoices(game.info.elevenLabsApiKey);
        if (voices.length === 0) {
            setAvailableVoices(DEFAULT_VOICES);
            setVoiceStatus({ type: 'warning', msg: "No custom voices. Loaded defaults." });
        } else {
            setAvailableVoices(voices);
            setVoiceStatus({ type: 'success', msg: `Loaded ${voices.length} voices.` });
        }
    } catch (e: any) {
        setAvailableVoices(DEFAULT_VOICES);
        setVoiceStatus({ type: 'warning', msg: "API Error. Loaded defaults." });
    } finally {
        setIsLoadingVoices(false);
    }
  };

  const handleOpenLibrary = async () => {
     setShowLibrary(true);
     if (sharedVoices.length === 0) {
        setLoadingShared(true);
        try {
           const voices = await fetchSharedVoices(game.info.elevenLabsApiKey!);
           setSharedVoices(voices);
        } catch (e) { console.error(e); } finally { setLoadingShared(false); }
     }
  };

  const handleAddSharedVoice = async (voice: SharedVoice) => {
     setAddingVoiceId(voice.voice_id);
     try {
        const success = await addSharedVoice(game.info.elevenLabsApiKey!, voice.public_owner_id, voice.voice_id, voice.name);
        if (success) {
           await handleFetchVoices();
           onUpdateActor(actor.id, { voiceId: voice.voice_id });
           setShowLibrary(false);
        } else { alert("Failed to add voice."); }
     } finally { setAddingVoiceId(null); }
  };

  const handlePreviewShared = (voice: SharedVoice) => {
     if (previewingSharedId) {
        const els = document.querySelectorAll('audio');
        els.forEach(el => el.pause());
     }
     if (voice.preview_url) {
        setPreviewingSharedId(voice.voice_id);
        const audio = new Audio(voice.preview_url);
        audio.onended = () => setPreviewingSharedId(null);
        audio.play().catch(e => { console.error(e); setPreviewingSharedId(null); });
     }
  };

  useEffect(() => {
      if (game.info.elevenLabsApiKey) handleFetchVoices();
  }, [game.info.elevenLabsApiKey]);

  const playVoicePreview = async (voiceId: string, textOverride?: string) => {
    if (!voiceId || !game.info.elevenLabsApiKey) return;
    setIsPreviewingVoice(true);
    try {
      const text = textOverride || "Reporting for duty. All systems operational.";
      const audioBase64 = await generateSpeech(game.info.elevenLabsApiKey, voiceId, text);
      if (audioBase64) {
         const audio = new Audio(audioBase64);
         setTimeout(() => audio.play().catch(() => {}), 500);
      }
    } catch (e) { console.error(e); } finally { setIsPreviewingVoice(false); }
  };

  const handleSurpriseMe = () => {
     if (!actor.voiceId) return;
     const randomLine = FUNNY_LINES[Math.floor(Math.random() * FUNNY_LINES.length)];
     playVoicePreview(actor.voiceId, randomLine);
  };

  const getAngleDescription = (angle: number) => {
    if (angle === 0) return "Front View (0 degrees). Face pointing directly at camera.";
    if (angle === 45) return "3/4 View (45 degrees). Head and face turned 45 degrees to the side.";
    if (angle === 90) return "Full Side Profile View (90 degrees). Head pointing completely to the left or right.";
    if (angle === 135) return "Rear 3/4 View (135 degrees). Back of head visible, face turned away.";
    if (angle === 180) return "Full Back View (180 degrees). Back of head only. Looking away from camera.";
    if (angle === 225) return "Rear 3/4 View (225 degrees). Back of head visible.";
    if (angle === 270) return "Full Side Profile View (270 degrees). Head pointing completely to the side.";
    if (angle === 315) return "3/4 View (315 degrees). Head and face turned 45 degrees to the side.";
    return `${angle} degrees`;
  };

  useEffect(() => {
    if (!actor || !autoUpdatePrompt) return;
    const identityPrompt = `Subject Identity: The character is defined VISUALLY by the Character Reference image. Name: "${actor.name}".`;
    const angleDesc = getAngleDescription(selectedAngle);
    let framingInstruction = "";
    if (['Full Body', 'Jump', 'Run', 'Crouch', 'Wave', 'Pointing'].includes(selectedPose)) {
        framingInstruction = " FRAMING: FULL BODY SHOT. Show entire character from top of head to bottom of feet.";
    }
    const details = `Target Output: High-quality 2D game sprite. Pose: ${selectedPose}. Expression: ${selectedExpression}. Camera Angle: ${angleDesc}.${framingInstruction}`;
    const style = `Art Style: Flat colors, imperfect black outlines (hand-drawn/comic style).`;
    const technical = `CRITICAL: The character must be ISOLATED on a SOLID BRIGHT GREEN BACKGROUND (Hex #00FF00). Do not render background.`;
    const negative = `IMPORTANT NEGATIVE PROMPT: Do not include text. Do not add background scene. Do not change facial features.`;
    setCustomPrompt(`${identityPrompt} ${details} ${style} ${technical} ${negative}`);
  }, [selectedPose, selectedExpression, selectedAngle, actor?.name, autoUpdatePrompt]);

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'closeUp' | 'fullBody') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const updates: Partial<Actor> = {};
        if (type === 'closeUp') {
            updates.referenceImageCloseUp = result;
            updates.image = result;
        } else {
            updates.referenceImageFullBody = result;
        }
        onUpdateActor(actor.id, updates);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateGraphic = async () => {
    if (!actor.referenceImageCloseUp && !actor.referenceImageFullBody) {
      alert("Please upload at least one Reference Sheet (Face or Body).");
      return;
    }
    setIsGenerating(true);
    setStagingImage(null);
    setAutoChromaApplied(false);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [];
      const addImagePart = (dataUrl: string | null) => {
        if (!dataUrl || !dataUrl.includes(',')) return false;
        try {
           const [meta, data] = dataUrl.split(',');
           const mimeType = meta.split(':')[1]?.split(';')[0];
           if (mimeType && data) {
              parts.push({ inlineData: { mimeType, data } });
              return true;
           }
        } catch(e) { console.warn("Image extraction failed", e); }
        return false;
      };
      
      const hasStyle = game.info.styleGuide && addImagePart(game.info.styleGuide);
      const hasCloseUp = actor.referenceImageCloseUp && addImagePart(actor.referenceImageCloseUp);
      const hasBody = actor.referenceImageFullBody && actor.referenceImageFullBody !== actor.referenceImageCloseUp && addImagePart(actor.referenceImageFullBody);

      let promptPrefix = "INSTRUCTIONS: ";
      if (hasStyle) promptPrefix += "Image 1 is ART STYLE. ";
      promptPrefix += "Generate new sprite based on provided character references. ";
      parts.push({ text: `${promptPrefix} ${customPrompt}` });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts }
      });

      let newImageBase64 = null;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            newImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }
      if (newImageBase64) {
        try {
           const transparentImage = await removeBackgroundGlobal(newImageBase64);
           setStagingImage(transparentImage);
           setAutoChromaApplied(true);
        } catch(e) {
           console.error("Auto-transparency failed", e);
           setStagingImage(newImageBase64);
        }
      }
    } catch (error: any) {
      alert(`Generation failed: ${error.message || "Unknown error"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProcessTransparency = async () => {
    if (!stagingImage) return;
    setIsProcessing(true);
    try {
        const newImage = await removeBackgroundGlobal(stagingImage);
        setStagingImage(newImage);
        setAutoChromaApplied(true);
    } catch(e) { console.error(e); } finally { setIsProcessing(false); }
  };

  const handleCommitGraphic = () => {
    if (!stagingImage) return;
    let updatedGraphics = actor.graphics ? [...actor.graphics] : [];
    if (currentGraphic) updatedGraphics = updatedGraphics.filter(g => g.id !== currentGraphic.id);
    const newGraphic: ActorGraphic = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        pose: selectedPose,
        expression: selectedExpression,
        angle: selectedAngle,
        image: stagingImage
    };
    updatedGraphics.push(newGraphic);
    onUpdateActor(actor.id, { graphics: updatedGraphics });
    setStagingImage(null);
    setAutoChromaApplied(false);
  };

  const handleDeleteGraphic = (graphicId: string) => {
    const updatedGraphics = actor.graphics.filter(g => g.id !== graphicId);
    onUpdateActor(actor.id, { graphics: updatedGraphics });
  };

  return (
    <div className="animate-fade-in pb-20 relative">
      <div className="flex justify-between items-center mb-4 border-b border-diesel-gold/30 pb-2">
        <h2 className="text-xl font-bold text-diesel-gold flex items-center gap-2">
          ACTOR EDITOR <span className="text-xs font-mono ml-2 text-diesel-steel">ID: {actor.id.substring(0,8)}</span>
        </h2>
        <button onClick={() => onDeleteActor(actor.id)} className="text-diesel-rust hover:text-white p-2">
          <Trash2 size={20} />
        </button>
      </div>

      {/* --- 1. TOP: MAIN VIEWPORT (LAB/REVIEW) --- */}
      <div className="mb-4 bg-diesel-black border border-diesel-gold/50 p-4 shadow-diesel-glow">
          {/* Status Header */}
          <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-diesel-gold uppercase flex items-center gap-2">
                 <Zap size={16} /> NANO BANANA LAB
              </h3>
              {isGenerating && <span className="text-xs text-diesel-gold animate-pulse">PROCESSING...</span>}
          </div>

          {/* LARGE VIEWPORT */}
          <div className="w-full aspect-square bg-[#1a1a1a] border border-diesel-border relative mb-4 flex items-center justify-center overflow-hidden bg-[linear-gradient(45deg,#111_25%,transparent_25%,transparent_75%,#111_75%,#111),linear-gradient(45deg,#111_25%,transparent_25%,transparent_75%,#111_75%,#111)] bg-[length:20px_20px]">
             {isGenerating ? (
                 <div className="flex flex-col items-center gap-4 text-diesel-gold">
                    <RefreshCw size={48} className="animate-spin" />
                    <div className="text-xs font-mono animate-pulse tracking-widest">SYNTHESIZING SPRITE...</div>
                 </div>
             ) : stagingImage ? (
                 <img src={stagingImage} className="w-full h-full object-contain" alt="Staged" />
             ) : currentGraphic ? (
                 <img src={currentGraphic.image} className="w-full h-full object-contain" alt="Current" />
             ) : (
                 <div className="text-diesel-steel opacity-30 flex flex-col items-center">
                    <Grid size={48} />
                    <span className="text-xs mt-2 font-mono">NO ASSET FOR SELECTION</span>
                 </div>
             )}
             
             {/* Staging Overlay Label */}
             {stagingImage && !isGenerating && (
                 <div className="absolute top-0 left-0 bg-diesel-gold text-black text-[10px] font-bold px-2 py-1 uppercase">
                    REVIEWING GENERATION
                 </div>
             )}
          </div>

          {/* CONTEXTUAL CONTROLS */}
          {stagingImage ? (
              // REVIEW MODE CONTROLS
              <div className="space-y-2">
                 <div className="flex gap-2">
                     <button 
                        onClick={handleProcessTransparency}
                        disabled={isProcessing}
                        className="flex-1 py-2 text-[10px] font-bold border border-diesel-steel text-diesel-steel hover:bg-white hover:text-black flex items-center justify-center gap-2"
                     >
                        {isProcessing ? <RefreshCw size={12} className="animate-spin"/> : <Scissors size={12}/>}
                        {autoChromaApplied ? "RE-APPLY CHROMA" : "APPLY CHROMA KEY"}
                     </button>
                 </div>
                 <div className="flex gap-2">
                    <button 
                       onClick={() => setStagingImage(null)}
                       className="flex-1 py-3 text-xs font-bold text-diesel-rust border border-diesel-rust hover:bg-diesel-rust/10 flex items-center justify-center gap-2"
                    >
                       <X size={14} /> DISCARD
                    </button>
                    <button 
                       onClick={handleCommitGraphic}
                       className="flex-1 py-3 text-xs font-bold text-black bg-diesel-gold hover:bg-white flex items-center justify-center gap-2"
                    >
                       <Check size={14} /> APPROVE
                    </button>
                 </div>
              </div>
          ) : (
              // EDIT/GENERATE MODE CONTROLS
              <div className="space-y-3">
                 <div className="grid grid-cols-3 gap-2">
                    <select 
                       className="bg-diesel-dark text-diesel-gold text-xs border border-diesel-border p-2 focus:outline-none font-bold"
                       value={selectedPose}
                       onChange={(e) => setSelectedPose(e.target.value)}
                    >
                       {availablePoses.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select 
                       className="bg-diesel-dark text-diesel-gold text-xs border border-diesel-border p-2 focus:outline-none font-bold"
                       value={selectedExpression}
                       onChange={(e) => setSelectedExpression(e.target.value)}
                    >
                       {availableExpressions.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <select 
                       className="bg-diesel-dark text-diesel-gold text-xs border border-diesel-border p-2 focus:outline-none font-bold"
                       value={selectedAngle}
                       onChange={(e) => setSelectedAngle(Number(e.target.value))}
                    >
                       {ANGLES.map(a => <option key={a} value={a}>{a}°</option>)}
                    </select>
                 </div>

                 {/* Prompt Override (Collapsed by default logic handled by Lock) */}
                 <div className="flex gap-2 items-center">
                    <button 
                       onClick={() => setAutoUpdatePrompt(!autoUpdatePrompt)}
                       className={`p-2 border ${autoUpdatePrompt ? 'border-diesel-green text-diesel-green' : 'border-diesel-rust text-diesel-rust'} hover:bg-white/5`}
                       title={autoUpdatePrompt ? "Unlock to Edit Prompt" : "Lock to Auto-Update"}
                    >
                       {autoUpdatePrompt ? <Lock size={14}/> : <Unlock size={14}/>}
                    </button>
                    <input 
                       className={`flex-1 bg-diesel-dark text-[10px] p-2 border font-mono focus:outline-none ${autoUpdatePrompt ? 'text-diesel-steel border-diesel-border opacity-50' : 'text-diesel-paper border-diesel-gold'}`}
                       value={customPrompt}
                       onChange={(e) => { setCustomPrompt(e.target.value); setAutoUpdatePrompt(false); }}
                       disabled={autoUpdatePrompt}
                    />
                 </div>

                 <button 
                    onClick={handleGenerateGraphic}
                    disabled={!actor.referenceImageCloseUp && !actor.referenceImageFullBody}
                    className={`w-full py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all
                       ${(actor.referenceImageCloseUp || actor.referenceImageFullBody) ? 'bg-diesel-gold text-black hover:bg-white' : 'bg-diesel-dark text-diesel-steel cursor-not-allowed border border-diesel-border'}
                    `}
                 >
                    <Cpu size={16} />
                    {currentGraphic ? "RE-GENERATE SPRITE" : "GENERATE SPRITE"}
                 </button>
              </div>
          )}
      </div>

      {/* --- 2. MIDDLE: COMPACT CONTROLS CLUSTER --- */}
      <div className="grid grid-cols-2 gap-3 mb-6">
         
         {/* LEFT COLUMN: IDENTITY & DNA */}
         <div className="space-y-3">
             {/* Name */}
             <div className="bg-diesel-dark p-2 border border-diesel-border">
                <CyberInput 
                   label="Identity" 
                   value={actor.name}
                   onChange={(e) => onUpdateActor(actor.id, { name: e.target.value })}
                   className="mb-0 text-xs"
                />
             </div>

             {/* DNA (Compact) */}
             <div className="bg-diesel-dark p-2 border border-diesel-border">
                 <div className="text-[10px] font-bold text-diesel-gold uppercase mb-2 flex items-center gap-1"><Eye size={10}/> Visual DNA</div>
                 <div className="flex gap-2">
                    <div className="flex-1 aspect-square bg-black relative group border border-diesel-border/50 hover:border-diesel-gold cursor-pointer">
                        {actor.referenceImageCloseUp ? <img src={actor.referenceImageCloseUp} className="w-full h-full object-cover opacity-60" /> : <div className="absolute inset-0 flex items-center justify-center text-[8px] text-diesel-steel">FACE</div>}
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleReferenceUpload(e, 'closeUp')} />
                    </div>
                    <div className="flex-1 aspect-square bg-black relative group border border-diesel-border/50 hover:border-diesel-gold cursor-pointer">
                        {actor.referenceImageFullBody ? <img src={actor.referenceImageFullBody} className="w-full h-full object-cover opacity-60" /> : <div className="absolute inset-0 flex items-center justify-center text-[8px] text-diesel-steel">BODY</div>}
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleReferenceUpload(e, 'fullBody')} />
                    </div>
                 </div>
             </div>
         </div>

         {/* RIGHT COLUMN: VOICE (Compact) */}
         <div className="bg-diesel-dark p-2 border border-diesel-border flex flex-col">
             <div className="text-[10px] font-bold text-diesel-gold uppercase mb-2 flex items-center gap-1"><Mic size={10}/> Voice Uplink</div>
             
             <div className="flex-1 flex flex-col gap-2">
                 <input 
                    className="w-full bg-black text-diesel-steel text-[10px] p-1.5 border border-diesel-border"
                    placeholder="Voice ID..."
                    value={actor.voiceId || ""}
                    onChange={(e) => onUpdateActor(actor.id, { voiceId: e.target.value })}
                 />
                 
                 <div className="flex gap-1">
                    <button onClick={handleFetchVoices} className="flex-1 bg-diesel-black border border-diesel-border text-[9px] text-diesel-steel hover:text-white py-1">REFRESH</button>
                    <button onClick={handleOpenLibrary} className="flex-1 bg-diesel-gold text-black text-[9px] font-bold hover:bg-white py-1">SCAN</button>
                 </div>

                 {availableVoices.length > 0 && (
                    <select 
                       className="w-full bg-black text-diesel-gold text-[10px] border border-diesel-border p-1"
                       onChange={(e) => { onUpdateActor(actor.id, { voiceId: e.target.value }); if(e.target.value) playVoicePreview(e.target.value); }}
                       value={actor.voiceId || ""}
                    >
                       <option value="">-- Select --</option>
                       {availableVoices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
                    </select>
                 )}

                 <div className="flex gap-1 mt-auto pt-2">
                     <button onClick={() => actor.voiceId && playVoicePreview(actor.voiceId)} disabled={!actor.voiceId} className="flex-1 border border-diesel-border hover:bg-white/10 text-diesel-steel py-1"><PlayCircle size={12} className="mx-auto"/></button>
                     <button onClick={handleSurpriseMe} disabled={!actor.voiceId} className="flex-1 border border-diesel-border hover:bg-white/10 text-diesel-steel py-1"><MessageSquare size={12} className="mx-auto"/></button>
                 </div>
             </div>
         </div>
      </div>

      {/* Signal Scanner Modal (Library) - kept same logic */}
      {showLibrary && (
         <div className="absolute inset-0 z-50 bg-diesel-black/95 backdrop-blur-md flex flex-col p-4 animate-fade-in border-4 border-diesel-gold shadow-2xl">
            <div className="flex justify-between items-center border-b-2 border-diesel-gold pb-3 mb-4 shrink-0">
               <h3 className="text-lg font-bold text-diesel-gold flex items-center gap-2"><Radio className="animate-pulse" /> SIGNAL SCANNER</h3>
               <button onClick={() => setShowLibrary(false)} className="text-diesel-rust hover:text-white"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
               {loadingShared ? (
                  <div className="flex flex-col items-center justify-center h-full text-diesel-gold gap-4"><RefreshCw size={48} className="animate-spin" /><p className="animate-pulse tracking-widest text-xs">SCANNING FREQUENCIES...</p></div>
               ) : (
                  <div className="space-y-2">
                     {sharedVoices.map((voice) => (
                        <div key={voice.voice_id} className="border border-diesel-border p-3 flex justify-between items-center hover:bg-diesel-gold/5 transition-colors bg-black/40">
                           <div className="flex-1 min-w-0 mr-2">
                              <div className="flex items-center gap-2 mb-1"><span className="text-diesel-paper font-bold text-sm truncate">{voice.name}</span><span className="text-[9px] border border-diesel-steel px-1 rounded text-diesel-steel uppercase">{voice.category}</span></div>
                           </div>
                           <button onClick={() => handleAddSharedVoice(voice)} disabled={addingVoiceId === voice.voice_id} className="px-3 py-1 bg-diesel-gold text-black text-xs font-bold hover:bg-white flex items-center gap-1 disabled:opacity-50">{addingVoiceId === voice.voice_id ? <RefreshCw size={12} className="animate-spin"/> : <Download size={12}/>} ACQUIRE</button>
                        </div>
                     ))}
                  </div>
               )}
            </div>
         </div>
      )}

      {/* --- 3. BOTTOM: GRAPHICS LIBRARY --- */}
      <div className="mb-8">
         <h3 className="text-sm font-bold text-diesel-paper mb-3 uppercase flex items-center gap-2">
           <Grid size={16} className="text-diesel-gold" />
           GRAPHICS LIBRARY ({actor.graphics ? actor.graphics.length : 0})
         </h3>
         <div className="grid grid-cols-6 gap-2">
           {actor.graphics && actor.graphics.map(graphic => (
             <div 
                key={graphic.id} 
                className={`aspect-square bg-[#1a1a1a] border relative group cursor-pointer bg-[linear-gradient(45deg,#111_25%,transparent_25%,transparent_75%,#111_75%,#111),linear-gradient(45deg,#111_25%,transparent_25%,transparent_75%,#111_75%,#111)] bg-[length:10px_10px] ${
                    graphic.id === currentGraphic?.id ? 'border-diesel-gold shadow-diesel-glow' : 'border-diesel-border hover:border-diesel-gold'
                }`}
                onClick={() => {
                    setSelectedPose(graphic.pose);
                    setSelectedExpression(graphic.expression);
                    setSelectedAngle(graphic.angle);
                    if (onSelect) onSelect('actor', actor.id, graphic.id);
                }}
             >
               <img src={graphic.image} className="w-full h-full object-contain" alt={graphic.pose} />
               <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                  <div className="text-[8px] text-center text-diesel-steel leading-tight">{graphic.pose}<br/>{graphic.expression}</div>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteGraphic(graphic.id); }} className="text-diesel-rust hover:text-red-400 p-1"><Trash2 size={12} /></button>
               </div>
             </div>
           ))}
           {(!actor.graphics || actor.graphics.length === 0) && (
             <div className="col-span-6 py-8 border border-diesel-border border-dashed flex flex-col items-center justify-center text-diesel-steel gap-2">
               <span className="text-xs">LIBRARY EMPTY</span>
             </div>
           )}
         </div>
      </div>
    </div>
  );
};