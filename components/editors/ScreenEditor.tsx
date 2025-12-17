import React, { useState } from 'react';
import { Trash2, RefreshCw, ImageIcon, Check, AlertTriangle, Download } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Drop, GameData } from '../../types';
import { CyberInput } from '../CyberInput';

interface DropEditorProps {
  game: GameData;
  drop: Drop;
  onUpdateDrop: (id: string, updates: Partial<Drop>) => void;
  onDeleteDrop: (id: string) => void;
  voiceEnabled?: boolean;
  onReturn?: () => void;
}

export const DropEditor: React.FC<DropEditorProps> = ({
  game,
  drop,
  onUpdateDrop,
  onDeleteDrop,
  voiceEnabled,
  onReturn
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateDrop = async () => {
    if (!process.env.API_KEY) {
        alert("System Error: API_KEY not found in environment.");
        return;
    }

    setIsGenerating(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [];

      // Safe image extraction helper
      const addImagePart = (dataUrl: string | null) => {
        if (!dataUrl || !dataUrl.includes(',')) return false;
        try {
           const [meta, data] = dataUrl.split(',');
           if (!meta || !data) return false;
           const mimeType = meta.split(':')[1]?.split(';')[0];
           if (mimeType && data) {
              parts.push({ inlineData: { mimeType, data } });
              return true;
           }
        } catch(e) { console.warn("Image extraction failed", e); }
        return false;
      };
      
      // If style guide exists, use it
      if (game.info.styleGuide && addImagePart(game.info.styleGuide)) {
         parts.push({ text: `Generate a full-screen cinematic image based on this description: "${drop.prompt}". IMPORTANT: You MUST match the art style of the provided reference image exactly (imperfect black hand-drawn lines, flat colors, specific shading). The output must look like it belongs in the exact same game universe. High quality, 16:9 aspect ratio.` });
      } else {
         parts.push({ text: `Generate a full-screen cinematic image based on this description: "${drop.prompt}". Style: Dieselpunk, industrial, gritty graphic novel aesthetic. Sepia tones, heavy shadows, oil stains. 16:9 ratio.` });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          imageConfig: { aspectRatio: '16:9' }
        }
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
        onUpdateDrop(drop.id, { image: newImageBase64 });
      } else {
        alert("Generation produced no image data.");
      }
    } catch (error: any) {
       console.error("Drop Generation failed:", JSON.stringify(error, null, 2));
       alert(`Generation failed: ${error.message || "Unknown error"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = () => {
    if (!drop.image) return;
    const name = drop.name || "drop_asset";
    const cleanName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const link = document.createElement('a');
    link.href = drop.image;
    link.download = `dramaton_drop_${cleanName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col md:flex-row animate-fade-in">
      
      {/* LEFT COLUMN: CONTROLS */}
      <div className="w-full md:w-96 p-6 border-r border-diesel-border bg-diesel-panel flex flex-col gap-6 shrink-0 h-full overflow-y-auto">
          <div className="flex justify-between items-center border-b border-diesel-paper/30 pb-2">
            <h2 className="text-xl font-bold text-diesel-paper flex items-center gap-2 uppercase tracking-widest">
              BACKDROP <span className="text-[10px] font-mono ml-1 text-diesel-steel opacity-50">ID: {drop.id.substring(0,6)}</span>
            </h2>
            <button 
              onClick={() => onDeleteDrop(drop.id)}
              className="text-diesel-rust hover:text-red-400 p-2"
              title="Delete Drop"
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="space-y-4">
             <CyberInput 
                label="Drop Name" 
                value={drop.name}
                onChange={(e) => onUpdateDrop(drop.id, { name: e.target.value })}
                className="text-diesel-paper border-diesel-paper/30 focus:border-diesel-paper text-lg font-bold"
             />

             <div>
                <label className="text-xs uppercase tracking-widest text-diesel-paper font-bold mb-2 block">
                   Visual Prompt
                </label>
                <textarea
                   className="w-full h-48 bg-black border border-diesel-paper/30 text-diesel-paper font-mono text-sm p-4 focus:outline-none focus:border-diesel-paper resize-none"
                   value={drop.prompt}
                   onChange={(e) => onUpdateDrop(drop.id, { prompt: e.target.value })}
                   placeholder="Describe the scene backdrop in detail..."
                />
             </div>

             <div className="flex flex-col gap-3 pt-4">
                <button 
                   onClick={handleGenerateDrop}
                   disabled={isGenerating}
                   className={`
                      w-full py-4 px-4 flex items-center justify-center gap-2 font-bold tracking-widest transition-all text-sm border-2
                      ${isGenerating 
                         ? 'bg-diesel-dark text-diesel-steel border-diesel-border cursor-wait' 
                         : 'bg-diesel-gold text-black border-diesel-gold hover:bg-white hover:border-white shadow-[0_0_15px_rgba(203,169,109,0.3)]'}
                   `}
                >
                   {isGenerating ? <RefreshCw className="animate-spin" size={18} /> : <ImageIcon size={18} />}
                   {isGenerating ? 'GENERATING...' : (drop.image ? 'RE-GENERATE' : 'GENERATE VISUAL')}
                </button>

                {onReturn && drop.image && (
                    <button 
                      onClick={onReturn}
                      className="w-full py-3 px-4 flex items-center justify-center gap-2 font-bold tracking-widest transition-all text-sm bg-diesel-green text-black hover:bg-white"
                    >
                       <Check size={16} /> RETURN TO SCENE
                    </button>
                )}
             </div>
          </div>
          
          <div className="mt-auto pt-6 text-[10px] text-diesel-steel font-mono opacity-70">
             TIP: Use descriptive lighting and atmosphere keywords (e.g., "neon-lit", "shadowy", "sepia-toned") for best results.
          </div>
      </div>

      {/* RIGHT COLUMN: PREVIEW */}
      <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden p-8">
          {/* Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:40px_40px] pointer-events-none"></div>

          {/* 16:9 Frame Constraint */}
          <div className="relative w-full max-w-7xl aspect-video bg-[#0a0a0a] shadow-2xl border border-diesel-border/50 overflow-hidden flex items-center justify-center group">
              {drop.image ? (
                <>
                    <img src={drop.image} className="w-full h-full object-cover" alt="Preview" />
                    
                    {/* Overlay Controls */}
                    <div className="absolute bottom-6 right-6 flex gap-2">
                      <button 
                          onClick={handleDownloadImage}
                          className="bg-black/80 hover:bg-diesel-gold text-white hover:text-black border border-white/20 hover:border-diesel-gold px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-2 font-bold text-xs uppercase tracking-widest transition-all shadow-xl"
                          title="Download Image"
                      >
                          <Download size={16} />
                          Download Asset
                      </button>
                    </div>
                </>
              ) : (
                <div className="text-diesel-steel text-sm text-center p-8 border-2 border-dashed border-diesel-border/30 rounded-lg flex flex-col items-center gap-4">
                    <ImageIcon size={48} className="opacity-20" />
                    <div>
                      <p className="font-bold tracking-widest opacity-50">NO SIGNAL</p>
                      <p className="text-xs opacity-30 mt-1">Configure prompt and generate to populate backdrop.</p>
                    </div>
                </div>
              )}

              {isGenerating && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-diesel-gold gap-4 animate-pulse z-50">
                    <RefreshCw size={48} className="animate-spin" />
                    <span className="text-sm font-mono tracking-[0.5em] uppercase">RECEIVING DATA STREAM...</span>
                </div>
              )}
          </div>
      </div>
    </div>
  );
};