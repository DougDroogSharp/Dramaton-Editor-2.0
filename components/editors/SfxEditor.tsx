import React, { useState, useEffect } from 'react';
import { Trash2, Sparkles, User, Package, Wand2, Loader2, RotateCw, Zap, RefreshCw, AlertTriangle, CheckCircle2, Check, Infinity, Play } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Sfx, GameData, Actor, ActorGraphic, SelectionType } from '../../types';
import { SFX_TYPES, POSES, EXPRESSIONS, ANGLES } from '../../constants';
import { CyberInput } from '../CyberInput';
import { CyberSlider } from '../CyberSlider';

interface SfxEditorProps {
  sfx: Sfx;
  onUpdateSfx: (id: string, updates: Partial<Sfx>) => void;
  onDeleteSfx: (id: string) => void;
  game?: GameData; 
  onUpdateActor?: (id: string, updates: Partial<Actor>) => void;
  onSelect?: (type: SelectionType, id: string | null) => void;
}

export const SfxEditor: React.FC<SfxEditorProps> = ({
  sfx,
  onUpdateSfx,
  onDeleteSfx,
  game,
  onUpdateActor,
  onSelect
}) => {
  const [previewTargetId, setPreviewTargetId] = useState<string>("");
  const [previewType, setPreviewType] = useState<'actor' | 'item'>('actor');
  
  // Pose Control State
  const [selectedPose, setSelectedPose] = useState(POSES[0]);
  const [selectedExpression, setSelectedExpression] = useState(EXPRESSIONS[0]);
  const [selectedAngle, setSelectedAngle] = useState(ANGLES[0]);
  const [isQuickGenerating, setIsQuickGenerating] = useState(false);

  // Nudge State
  const [isNudging, setIsNudging] = useState(false);
  const [nudgeStatus, setNudgeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // Replay Trigger key
  const [replayKey, setReplayKey] = useState(0);

  // Ensure game is defined to avoid crashes if parent doesn't pass it yet
  const safeGame = game || { actors: [], items: [] };

  // AUTO-SELECT FIRST ASSET ON MOUNT
  useEffect(() => {
     if (previewTargetId) return; // Already selected
     
     if (safeGame.actors.length > 0) {
        setPreviewType('actor');
        setPreviewTargetId(safeGame.actors[0].id);
     } else if (safeGame.items.length > 0) {
        setPreviewType('item');
        setPreviewTargetId(safeGame.items[0].id);
     }
  }, [safeGame.actors, safeGame.items]); 

  // SYNC POSE DEFAULTS WHEN ACTOR CHANGES
  useEffect(() => {
     if (previewType === 'actor' && previewTargetId) {
        const actor = safeGame.actors.find(a => a.id === previewTargetId);
        if (actor && actor.graphics && actor.graphics.length > 0) {
            const g = actor.graphics[0];
            setSelectedPose(g.pose);
            setSelectedExpression(g.expression);
            setSelectedAngle(g.angle);
        }
     }
  }, [previewTargetId, previewType]);

  // DETACH OLD EFFECT: Auto-replay when params change
  useEffect(() => {
    setReplayKey(prev => prev + 1);
  }, [sfx.type, sfx.category, sfx.params.intensity, sfx.params.speed, sfx.params.color, sfx.params.duration]);

  // Clear success status after delay
  useEffect(() => {
    if (nudgeStatus === 'success' || nudgeStatus === 'error') {
        const timer = setTimeout(() => setNudgeStatus('idle'), 3000);
        return () => clearTimeout(timer);
    }
  }, [nudgeStatus]);

  // Helper to get preview image - UPDATED: Return fallback + flag
  const getPreviewImage = (): { src: string | null, isFallback: boolean } => {
    if (!previewTargetId) return { src: null, isFallback: false };
    
    if (previewType === 'actor') {
        const actor = safeGame.actors.find((a: Actor) => a.id === previewTargetId);
        if (!actor) return { src: null, isFallback: false };
        
        if (actor.graphics) {
            const specific = actor.graphics.find(g => 
                g.pose === selectedPose && 
                g.expression === selectedExpression && 
                g.angle === selectedAngle
            );
            if (specific) return { src: specific.image, isFallback: false };
        }
        // Fallback to reference
        const fallback = actor.image || actor.referenceImageCloseUp || actor.referenceImageFullBody;
        return { src: fallback || null, isFallback: true };
    } else {
        const item = safeGame.items.find((i: any) => i.id === previewTargetId);
        return { src: item ? item.visualAsset : null, isFallback: false };
    }
  };

  // Helper to generate style based on current SFX params
  const getPreviewStyle = () => {
    const style: React.CSSProperties = {};
    const { intensity, speed, color } = sfx.params;

    // Reset basics
    style.opacity = 1;
    style.animation = 'none';
    style.filter = 'none';
    style.transition = 'all 0.3s ease';

    // EXCLUSIVE LOGIC
    if (sfx.type === 'glow') {
        // STATIC: No animation
        style.filter = `drop-shadow(0 0 ${intensity / 2}px ${color})`;
        style.animation = 'none'; 
    }
    else if (sfx.type === 'pulse') {
        // ANIMATED: Pulse
        const durationSec = 2 - (speed! / 100) * 1.8; 
        style.animation = `sfx-pulse ${durationSec}s infinite ease-in-out`;
        style.filter = `drop-shadow(0 0 ${intensity / 5}px ${color})`;
    }
    else if (sfx.type === 'shake') {
        // ONE-SHOT/ANIMATED: Shake
        const durationSec = 1 - (speed! / 100) * 0.9;
        style.animation = `sfx-shake ${durationSec}s infinite linear`;
    }
    else if (sfx.type === 'jiggle') {
        // ANIMATED: Jiggle
        const durationSec = 1 - (speed! / 100) * 0.8;
        style.animation = `sfx-jiggle ${durationSec}s infinite ease-in-out`;
    }
    else if (sfx.type === 'fade') {
        // STATIC/ONE-SHOT: Opacity
        style.opacity = (100 - intensity) / 100;
    }
    else if (sfx.type === 'electric' || (sfx.type as string) === 'flash') {
         // NEW: Electric / Flash
         const durationSec = 2.0 - ((speed || 50) / 100) * 1.8; 
         style.animation = `sfx-electric ${durationSec}s infinite linear`;
         style.color = color || '#ffff00'; 
    }

    return style;
  };

  const handleCategoryChange = (newCategory: 'ATTACH' | 'DO') => {
      // If changing category, check if current type is valid. If not, pick first valid.
      const validTypes = SFX_TYPES[newCategory];
      const currentTypeIsValid = validTypes.includes(sfx.type);
      
      onUpdateSfx(sfx.id, { 
          category: newCategory,
          type: currentTypeIsValid ? sfx.type : validTypes[0]
      });
  };

  const handleInterpretDescription = async () => {
    const promptText = sfx.prompt || "";
    if (!promptText.trim() || !process.env.API_KEY) {
        setNudgeStatus('error');
        alert("API Key missing or Prompt empty.");
        return;
    }
    setIsNudging(true);
    setNudgeStatus('idle');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = `You are a VFX engine tuner for a 2D game. 
      Your goal is to interpret natural language requests into specific engine parameters.
      
      Input Description: "${promptText}"
      
      Available Effect Types (SELECT ONE):
      - glow (Category: ATTACH) -> STATIC. Adds a colored outline/shadow. NO MOVEMENT.
      - pulse (Category: ATTACH) -> ANIMATED. Grows and shrinks rhythmically. Includes a glow.
      - jiggle (Category: ATTACH) -> ANIMATED. Rotates back and forth quickly. No glow.
      - shake (Category: DO) -> ONE-SHOT. Violent lateral shaking.
      - fade (Category: DO) -> ONE-SHOT. Opacity fade out.
      - electric (Category: ATTACH) -> ANIMATED. High contrast, flickering, multi-color chaos. Use for lightning, storm, shock, electricity, energy beams.
      
      Rules:
      1. 'static', 'still', 'aura', 'outline' -> 'glow'.
      2. 'heartbeat', 'breathing', 'energy' -> 'pulse'.
      3. 'nervous', 'wiggle', 'shiver' -> 'jiggle'.
      4. 'lightning', 'storm', 'zap', 'shock', 'electric', 'flash' -> 'electric'.
      
      Return strict JSON with 'type', 'category', and 'params' (intensity, speed, color, duration).
      For 'lightning', use high speed (90+) and a vibrant color like #FFFF00 or #00FFFF.`;
      
      const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: promptText,
          config: {
              responseMimeType: "application/json",
              systemInstruction: systemInstruction
          }
      });
      
      const responseText = response.text;
      if (responseText) {
          const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          const updates = JSON.parse(cleanedText);
          
           const allowedTypes = ['pulse', 'jiggle', 'glow', 'shake', 'fade', 'electric'];
           if (updates.type && allowedTypes.includes(updates.type)) {
                onUpdateSfx(sfx.id, { ...updates });
                setNudgeStatus('success');
           } else {
                setNudgeStatus('error');
           }
      }
    } catch (e) {
      console.error("Interpretation failed", e);
      setNudgeStatus('error');
    } finally {
      setIsNudging(false);
    }
  };

  const handleQuickGenerate = async () => {
    if (!previewTargetId || previewType !== 'actor' || !onUpdateActor || !process.env.API_KEY) {
        alert("Cannot generate: Missing API Key or Actor selection.");
        return;
    }
    
    const actor = safeGame.actors.find(a => a.id === previewTargetId);
    if (!actor) return;
    
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

        if (game?.info.styleGuide) {
             const styleMeta = game.info.styleGuide.split(',')[0];
             const styleData = game.info.styleGuide.split(',')[1];
             const styleMime = styleMeta.split(':')[1]?.split(';')[0];
             parts.push({ inlineData: { mimeType: styleMime, data: styleData } });
        }

        const prompt = `Generate a high-quality 2D game sprite. 
        Character Name: ${actor.name}.
        Pose: ${selectedPose}.
        Expression: ${selectedExpression}.
        Camera Angle: ${selectedAngle} degrees.
        Background: SOLID BRIGHT GREEN (#00FF00).
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
                        pose: selectedPose,
                        expression: selectedExpression,
                        angle: selectedAngle,
                        image: processedImage
                    };
                    const updatedGraphics = [...(actor.graphics || []), newGraphic];
                    onUpdateActor(actor.id, { graphics: updatedGraphics });
                }
            };
        } else {
            throw new Error("No image data returned from model.");
        }
    } catch (e) {
        console.error("Quick Gen Failed", e);
        alert("Failed to generate sprite. Check console for details.");
    } finally {
        setIsQuickGenerating(false);
    }
  };

  const { src: previewImage, isFallback } = getPreviewImage();

  return (
    <div className="animate-fade-in pb-20 flex flex-col h-full relative">
      <div className="flex justify-between items-center mb-6 border-b border-diesel-green/30 pb-2 shrink-0">
        <h2 className="text-2xl font-bold text-diesel-green flex items-center gap-2">
          VISUAL FX <span className="text-xs font-mono ml-2 text-diesel-steel">ID: {sfx.id.substring(0,8)}</span>
        </h2>
        <button 
          onClick={() => onDeleteSfx(sfx.id)}
          className="text-diesel-rust hover:text-red-400 p-2"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-16">
        
        <CyberInput 
            label="Effect Name" 
            value={sfx.name}
            onChange={(e) => onUpdateSfx(sfx.id, { name: e.target.value })}
            className="text-diesel-green border-diesel-green/30 focus:border-diesel-green font-bold text-lg"
        />

        {/* CATEGORY TOGGLE */}
        <div className="mb-4 mt-4">
             <label className="text-xs uppercase tracking-widest text-diesel-green font-bold mb-2 block">
                Effect Behavior Category
             </label>
             <div className="flex gap-2">
                 <button 
                    onClick={() => handleCategoryChange('ATTACH')}
                    className={`flex-1 py-3 px-2 border text-xs font-bold uppercase transition-all flex flex-col items-center gap-1 ${
                        sfx.category === 'ATTACH' 
                        ? 'bg-diesel-green text-black border-diesel-green shadow-diesel-glow' 
                        : 'text-diesel-steel border-diesel-border hover:bg-white/5'
                    }`}
                 >
                    <Infinity size={18} />
                    Continuous (Attach)
                 </button>
                 <button 
                    onClick={() => handleCategoryChange('DO')}
                    className={`flex-1 py-3 px-2 border text-xs font-bold uppercase transition-all flex flex-col items-center gap-1 ${
                        sfx.category === 'DO' 
                        ? 'bg-diesel-rust text-black border-diesel-rust shadow-diesel-rust-glow' 
                        : 'text-diesel-steel border-diesel-border hover:bg-white/5'
                    }`}
                 >
                    <Play size={18} />
                    One-Shot (Action)
                 </button>
             </div>
             <div className="text-[10px] text-diesel-steel mt-1 italic">
                 {sfx.category === 'ATTACH' 
                   ? 'Attached effects loop continuously (e.g. Glowing Aura, Glitch).' 
                   : 'One-Shot effects play once when triggered (e.g. Shake, Flash).'}
             </div>
        </div>

        {/* PREVIEW STAGE */}
        <div className="bg-diesel-dark border border-diesel-green/50 p-4 mb-4 relative overflow-hidden">
            {/* ... controls ... */}
            <div className="absolute top-2 left-2 flex gap-2 z-10 flex-wrap max-w-full">
                <button 
                    onClick={() => setPreviewType('actor')}
                    className={`p-1.5 rounded border text-[10px] font-bold flex items-center gap-1 ${previewType === 'actor' ? 'bg-diesel-green text-black border-diesel-green' : 'bg-black text-diesel-green border-diesel-green/30'}`}
                >
                    <User size={12}/> ACTOR
                </button>
                <button 
                    onClick={() => setPreviewType('item')}
                    className={`p-1.5 rounded border text-[10px] font-bold flex items-center gap-1 ${previewType === 'item' ? 'bg-diesel-green text-black border-diesel-green' : 'bg-black text-diesel-green border-diesel-green/30'}`}
                >
                    <Package size={12}/> ITEM
                </button>
                <select 
                    className="bg-black text-white text-[10px] border border-diesel-green/30 px-2 py-1 focus:outline-none focus:border-diesel-green"
                    value={previewTargetId}
                    onChange={(e) => setPreviewTargetId(e.target.value)}
                >
                    <option value="">-- Select Target --</option>
                    {previewType === 'actor' 
                        ? safeGame.actors.map((a: Actor) => <option key={a.id} value={a.id}>{a.name}</option>)
                        : safeGame.items.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)
                    }
                </select>

                {previewType === 'actor' && (
                    <>
                        <div className="h-6 w-px bg-diesel-green/30 mx-1"></div>
                        <select 
                            className="bg-black text-diesel-green text-[10px] border border-diesel-green/30 px-1 py-1 focus:outline-none w-20"
                            value={selectedPose}
                            onChange={(e) => setSelectedPose(e.target.value)}
                        >
                            {POSES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select 
                            className="bg-black text-diesel-green text-[10px] border border-diesel-green/30 px-1 py-1 focus:outline-none w-20"
                            value={selectedExpression}
                            onChange={(e) => setSelectedExpression(e.target.value)}
                        >
                            {EXPRESSIONS.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                        <select 
                            className="bg-black text-diesel-green text-[10px] border border-diesel-green/30 px-1 py-1 focus:outline-none w-16"
                            value={selectedAngle}
                            onChange={(e) => setSelectedAngle(Number(e.target.value))}
                        >
                            {ANGLES.map(a => <option key={a} value={a}>{a}°</option>)}
                        </select>
                        
                        {(isFallback || !previewImage) && (
                             <button 
                                onClick={handleQuickGenerate}
                                disabled={isQuickGenerating}
                                className="px-2 py-1 bg-diesel-rust text-black text-[10px] font-bold hover:bg-white flex items-center gap-1 animate-pulse border border-diesel-rust"
                                title="Generate Specific Sprite for this Pose/Angle"
                             >
                                {isQuickGenerating ? <RefreshCw size={10} className="animate-spin"/> : <Zap size={10}/>}
                                GEN SPRITE
                             </button>
                        )}
                    </>
                )}
            </div>

            <div className="w-full h-[400px] bg-[#151515] flex items-center justify-center border border-diesel-border/50 relative rounded-md overflow-hidden">
                {previewImage ? (
                    <>
                        <img 
                            key={replayKey}
                            src={previewImage} 
                            className={`h-full w-full object-contain p-2 transition-all duration-300 ${isFallback ? 'opacity-50 grayscale' : ''}`}
                            style={getPreviewStyle()} 
                            alt="SFX Preview" 
                        />
                        {isFallback && (
                             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="bg-diesel-rust/90 border border-diesel-rust text-black px-4 py-2 font-bold text-xs uppercase tracking-widest shadow-xl flex flex-col items-center">
                                    <span>NO GRAPHIC FOUND FOR THIS POSE/ANGLE</span>
                                    <span className="text-[9px] font-normal opacity-80">(PREVIEWING FALLBACK)</span>
                                </div>
                             </div>
                        )}
                    </>
                ) : (
                    <div className="text-diesel-steel text-xs text-center opacity-50 flex flex-col items-center gap-2">
                        <Sparkles size={24} />
                        <span>SELECT ASSET TO PREVIEW EFFECT</span>
                    </div>
                )}
            </div>
            
            <div className="flex justify-between items-center mt-1">
               <div className="text-[10px] text-diesel-green font-mono uppercase flex items-center gap-2">
                  TYPE: <span className="text-white font-bold">{sfx.type}</span>
                  <span className="text-diesel-steel opacity-50">|</span>
                  <span className="text-diesel-steel">Speed: {sfx.params.speed}%</span>
               </div>
               <button onClick={() => setReplayKey(k => k + 1)} className="text-diesel-green hover:text-white p-1" title="Restart Animation">
                  <RotateCw size={12} />
               </button>
            </div>
        </div>

        {/* MAIN TUNER INPUT */}
        <div className="mb-6 bg-diesel-black border border-diesel-green/30 p-3 mt-4">
            <h3 className="text-xs font-bold text-diesel-green mb-2 flex items-center gap-2 uppercase">
                <Wand2 size={14} /> Description Tuner
            </h3>
            <div className="flex gap-2">
                <input 
                    className="flex-1 bg-diesel-dark text-white text-xs border border-diesel-border p-2 focus:outline-none focus:border-diesel-green font-mono placeholder-gray-600"
                    placeholder="Describe effect (e.g. 'Blue static glow' or 'Fast lightning')..."
                    value={sfx.prompt || ""}
                    onChange={(e) => onUpdateSfx(sfx.id, { prompt: e.target.value })}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isNudging) {
                            handleInterpretDescription();
                        }
                    }}
                />
                <button 
                    onClick={handleInterpretDescription}
                    disabled={isNudging || !sfx.prompt}
                    className={`
                        px-4 py-1 text-xs font-bold transition-all border flex items-center gap-2
                        ${nudgeStatus === 'success' ? 'bg-diesel-green text-black border-diesel-green' : 
                          nudgeStatus === 'error' ? 'bg-diesel-rust text-white border-diesel-rust' : 
                          'bg-diesel-green/20 text-diesel-green border-diesel-green hover:bg-diesel-green hover:text-black'}
                    `}
                >
                    {isNudging ? <Loader2 size={14} className="animate-spin"/> : 
                     nudgeStatus === 'success' ? <CheckCircle2 size={14} /> : 
                     nudgeStatus === 'error' ? <AlertTriangle size={14} /> : 
                     <Sparkles size={14} />}
                    {isNudging ? 'TUNING...' : nudgeStatus === 'success' ? 'APPLIED' : 'APPLY TUNE'}
                </button>
            </div>
        </div>

        {/* Parameters (Manual Override) */}
        <div className="border-t border-diesel-green/20 pt-4 pb-12">
            <h3 className="text-xs font-bold text-diesel-steel mb-4 uppercase">Parameter Fine-Tuning</h3>
            
            <CyberSlider 
                label="Intensity / Scale"
                value={sfx.params.intensity}
                onChange={(val) => onUpdateSfx(sfx.id, { params: { ...sfx.params, intensity: val } })}
                color="text-diesel-green"
            />

            {/* Hide Speed for Glow (Static) to avoid confusion */}
            {sfx.type !== 'glow' && (
                <CyberSlider 
                    label="Speed"
                    value={sfx.params.speed || 50}
                    onChange={(val) => onUpdateSfx(sfx.id, { params: { ...sfx.params, speed: val } })}
                    color="text-blue-500"
                />
            )}

            {(sfx.type === 'pulse' || sfx.type === 'glow' || sfx.type === 'fade' || sfx.type === 'electric') && (
            <div className="mb-4">
                <label className="text-xs uppercase tracking-widest text-diesel-green font-bold mb-1 block">
                Tint Color (Hex)
                </label>
                <div className="flex gap-2">
                <input 
                    type="color" 
                    value={sfx.params.color || '#ffffff'}
                    onChange={(e) => onUpdateSfx(sfx.id, { params: { ...sfx.params, color: e.target.value } })}
                    className="bg-black border border-diesel-border h-8 w-8 p-0 cursor-pointer"
                />
                <input 
                    type="text"
                    value={sfx.params.color || '#ffffff'}
                    onChange={(e) => onUpdateSfx(sfx.id, { params: { ...sfx.params, color: e.target.value } })}
                    className="flex-1 bg-black text-white border border-diesel-border p-2 text-xs font-mono focus:outline-none focus:border-diesel-green"
                />
                </div>
            </div>
            )}

            {sfx.category === 'DO' && (
            <div className="mb-4">
                <label className="text-xs uppercase tracking-widest text-diesel-green font-bold mb-1 block">
                Duration (Seconds)
                </label>
                <input 
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={sfx.params.duration || 1}
                    onChange={(e) => onUpdateSfx(sfx.id, { params: { ...sfx.params, duration: Number(e.target.value) } })}
                    className="w-full bg-black text-white border border-diesel-border p-2 text-xs font-mono focus:outline-none focus:border-diesel-green"
                />
            </div>
            )}
        </div>
      </div>
      
      {/* DONE / EXIT BUTTON */}
      {onSelect && (
         <div className="absolute bottom-0 left-0 right-0 p-4 bg-diesel-black border-t border-diesel-border z-20">
             <button 
                onClick={() => onSelect('settings', null)}
                className="w-full py-3 bg-diesel-green text-black font-bold uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-2"
             >
                <Check size={16} /> FINISH EDITING
             </button>
         </div>
      )}
    </div>
  );
};