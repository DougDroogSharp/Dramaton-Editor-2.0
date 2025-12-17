import React, { useState } from 'react';
import { Trash2, Package, RefreshCw, X, Check, Zap, Scissors } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Item, GameData, ItemCategory, AcquisitionType, Operator } from '../../types';
import { ITEM_CATEGORIES, ACQUISITION_TYPES, OPERATORS } from '../../constants';
import { CyberInput } from '../CyberInput';

interface ItemEditorProps {
  game: GameData;
  item: Item;
  onUpdateItem: (id: string, updates: Partial<Item>) => void;
  onDeleteItem: (id: string) => void;
}

export const ItemEditor: React.FC<ItemEditorProps> = ({
  game,
  item,
  onUpdateItem,
  onDeleteItem
}) => {
  const [newEffectKey, setNewEffectKey] = useState("");
  const [newEffectValue, setNewEffectValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [stagingImage, setStagingImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddEffect = () => {
    if (newEffectKey.trim()) {
      const newEffect = { variable: newEffectKey.trim(), value: newEffectValue };
      const updatedEffects = [...item.effects, newEffect];
      onUpdateItem(item.id, { effects: updatedEffects });
      setNewEffectKey("");
      setNewEffectValue("");
    }
  };

  const handleRemoveEffect = (idx: number) => {
    const updatedEffects = [...item.effects];
    updatedEffects.splice(idx, 1);
    onUpdateItem(item.id, { effects: updatedEffects });
  };

  const updateUnlockCondition = (field: 'variable' | 'operator' | 'threshold', value: any) => {
    const current = item.unlockCondition || { variable: '', operator: '==', threshold: 0 };
    onUpdateItem(item.id, { unlockCondition: { ...current, [field]: value } });
  };

  const handleGenerateItem = async () => {
    if (!process.env.API_KEY) return;
    
    setIsGenerating(true);
    setStagingImage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [];
      
      const descriptionPrompt = item.description 
        ? `Visual Description: ${item.description}` 
        : `A typical ${item.category} item named "${item.name}".`;

      const prompt = `Generate a high-quality 2D game icon/sprite.
      ${descriptionPrompt}
      Category: ${item.category}.
      Style: Dieselpunk, brass, oil, gritty. Flat colors, imperfect outlines.
      
      CRITICAL: The item MUST be ISOLATED on a SOLID BRIGHT GREEN BACKGROUND (Hex #00FF00) to allow for easy chroma key transparency removal. 
      Do NOT add any background texture, shadow, or scene. 
      Do NOT include any text or UI elements.`;

      // Use Master Style Guide if available
      if (game.info.styleGuide) {
         const styleBase64 = game.info.styleGuide.split(',')[1];
         const styleMime = game.info.styleGuide.split(';')[0].split(':')[1];
         parts.push({ inlineData: { mimeType: styleMime, data: styleBase64 } });
         parts.push({ text: `${prompt} IMPORTANT: Match the art style of the provided STYLE GUIDE image.` });
      } else {
         parts.push({ text: prompt });
      }

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
        setStagingImage(newImageBase64);
        // Auto-attempt cleanup since we asked for solid green
        handleProcessTransparency(newImageBase64); 
      }
    } catch (error) {
       console.error("Item Generation failed:", error);
       alert("Generation failed. Please check your API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Modified to optionally accept an image to process immediately
  const handleProcessTransparency = async (imageToProcess: string | null = stagingImage) => {
    if (!imageToProcess) return;
    setIsProcessing(true);
    
    // Global Color Replacement (Chroma Key)
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
                
                // Sample 4 corners to determine background color
                const corners = [
                    0, 
                    (w - 1) * 4, 
                    (h - 1) * w * 4, 
                    (w * h - 1) * 4
                ];

                const cornerColors = corners.map(idx => ({
                    r: data[idx],
                    g: data[idx + 1],
                    b: data[idx + 2]
                }));

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
                    // Skip already transparent
                    if (data[i+3] === 0) continue;

                    if (match(r, g, b)) {
                        data[i+3] = 0; // Transparent
                    }
                }
                
                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL());
            };
            img.onerror = reject;
        });
    };

    try {
        const newImage = await removeBackgroundGlobal(imageToProcess);
        setStagingImage(newImage);
    } catch(e) {
        console.error("Processing failed", e);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCommitItemGraphic = () => {
    if (stagingImage) {
      onUpdateItem(item.id, { visualAsset: stagingImage });
      setStagingImage(null);
    }
  };

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex justify-between items-center mb-6 border-b border-diesel-gold/30 pb-2">
        <h2 className="text-2xl font-bold text-diesel-gold flex items-center gap-2">
          ITEM EDITOR <span className="text-xs font-mono ml-2 text-diesel-steel">ID: {item.id.substring(0,8)}</span>
        </h2>
        <button 
          onClick={() => onDeleteItem(item.id)}
          className="text-diesel-rust hover:text-red-400 p-2"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <CyberInput 
        label="Item Name" 
        value={item.name}
        onChange={(e) => onUpdateItem(item.id, { name: e.target.value })}
        className="text-diesel-gold border-diesel-gold/30 focus:border-diesel-gold"
      />
      
      <div className="mb-4">
        <label className="text-xs uppercase tracking-widest text-diesel-gold font-bold mb-2 block">
           Visual Description (for Generation)
        </label>
        <textarea 
           className="w-full bg-black text-diesel-paper border border-diesel-gold/30 p-2 text-xs focus:outline-none font-mono h-20"
           placeholder="e.g. A rusty brass key with a skull handle..."
           value={item.description || ""}
           onChange={(e) => onUpdateItem(item.id, { description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs uppercase tracking-widest text-diesel-gold font-bold mb-2 block">
            Category
          </label>
          <select 
            className="w-full bg-black text-diesel-gold border border-diesel-gold/30 p-2 text-xs focus:outline-none uppercase font-bold"
            value={item.category}
            onChange={(e) => onUpdateItem(item.id, { category: e.target.value as ItemCategory })}
          >
            {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-diesel-gold font-bold mb-2 block">
            Acquisition
          </label>
          <select 
            className="w-full bg-black text-diesel-gold border border-diesel-gold/30 p-2 text-xs focus:outline-none uppercase font-bold"
            value={item.acquisition}
            onChange={(e) => onUpdateItem(item.id, { acquisition: e.target.value as AcquisitionType })}
          >
            {ACQUISITION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

       {/* Nano Banana Lab (Generator) */}
       <div className="mb-6 bg-black border border-diesel-gold/50 p-3 shadow-[0_0_10px_rgba(203,169,109,0.2)] relative">
         <h3 className="text-sm font-bold text-diesel-gold mb-3 uppercase flex items-center gap-2 border-b border-diesel-gold/20 pb-2">
           <Zap size={16} />
           NANO BANANA LAB
         </h3>
         
         {isGenerating ? (
            <div className="h-48 flex flex-col items-center justify-center text-diesel-gold gap-2 bg-diesel-dark border border-dashed border-diesel-gold/30">
              <RefreshCw size={24} className="animate-spin" />
              <span className="text-xs font-mono animate-pulse">GENERATING ITEM...</span>
            </div>
         ) : stagingImage ? (
            <div className="h-auto bg-diesel-dark border border-diesel-gold p-3 animate-fade-in">
               <div className="w-full h-48 mx-auto bg-[#1a1a1a] border border-diesel-border mb-3 flex items-center justify-center overflow-hidden bg-[length:10px_10px]">
                  <img src={stagingImage} className="max-w-full max-h-full object-contain" alt="Staged" />
               </div>
               
               {/* PROCESSING TOOLS */}
               <div className="flex gap-2 mb-2">
                  <button 
                     onClick={() => handleProcessTransparency()}
                     disabled={isProcessing}
                     className="w-full py-1 text-[10px] font-bold border border-diesel-steel text-diesel-steel hover:bg-white hover:text-black flex items-center justify-center gap-1"
                     title="Removes background using global color replacement from corners"
                  >
                     {isProcessing ? <RefreshCw size={12} className="animate-spin"/> : <Scissors size={12}/>}
                     CHROMA KEY (GLOBAL)
                  </button>
               </div>

               <div className="flex gap-2">
                  <button 
                    onClick={() => setStagingImage(null)}
                    className="flex-1 py-3 text-xs font-bold text-diesel-rust border border-diesel-rust hover:bg-diesel-rust/10 flex items-center justify-center gap-1"
                  >
                     <X size={14} /> DISCARD
                  </button>
                  <button 
                    onClick={handleCommitItemGraphic}
                    className="flex-1 py-3 text-xs font-bold text-black bg-diesel-gold hover:bg-white flex items-center justify-center gap-1"
                  >
                     <Check size={14} /> APPROVE
                  </button>
               </div>
            </div>
         ) : (
            <div className="flex gap-3">
               <div className="w-16 h-16 bg-black border border-diesel-border shrink-0 relative flex items-center justify-center overflow-hidden">
                   {item.visualAsset ? (
                     <img src={item.visualAsset} className="w-full h-full object-contain" />
                   ) : (
                     <Package size={24} className="text-gray-700" />
                   )}
                </div>
               <button 
                onClick={handleGenerateItem}
                className="flex-1 bg-diesel-gold/20 text-diesel-gold border border-diesel-gold hover:bg-diesel-gold hover:text-black font-bold tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <Zap size={16} /> {item.visualAsset ? "RE-GENERATE ASSET" : "GENERATE ASSET"}
              </button>
            </div>
         )}
      </div>

      {/* Unlock Logic */}
      <div className="mb-6 bg-diesel-dark p-4 border border-diesel-gold/20">
         <h3 className="text-xs font-bold text-diesel-gold mb-4 uppercase flex items-center gap-2">
           Unlock Condition
         </h3>
         {item.acquisition === 'earned' ? (
           <div className="flex gap-2 items-center">
              <span className="text-xs font-mono text-diesel-steel">IF</span>
              <input 
                className="flex-1 bg-black text-white border border-diesel-border p-2 text-xs font-mono focus:border-diesel-gold outline-none"
                placeholder="VARIABLE"
                value={item.unlockCondition?.variable || ''}
                onChange={(e) => updateUnlockCondition('variable', e.target.value)}
              />
              <select 
                className="w-16 bg-black text-white border border-diesel-border p-2 text-xs font-mono focus:border-diesel-gold outline-none font-bold"
                value={item.unlockCondition?.operator || '=='}
                onChange={(e) => updateUnlockCondition('operator', e.target.value)}
              >
                {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              <input 
                 className="w-20 bg-black text-white border border-diesel-border p-2 text-xs font-mono focus:border-diesel-gold outline-none"
                 placeholder="VALUE"
                 value={String(item.unlockCondition?.threshold || '')}
                 onChange={(e) => updateUnlockCondition('threshold', e.target.value)}
              />
           </div>
         ) : (
           <div className="text-xs text-diesel-steel italic">Available via pickup in world.</div>
         )}
      </div>

      {/* Effects */}
      <div className="mb-6 bg-diesel-dark p-4 border border-diesel-gold/20">
         <h3 className="text-xs font-bold text-diesel-gold mb-4 uppercase flex items-center gap-2">
           Equipped Effects
         </h3>
         
         <div className="flex gap-2 mb-4">
            <input 
              className="flex-1 bg-black text-white border border-diesel-border p-2 text-xs font-mono focus:border-diesel-gold outline-none"
              placeholder="VAR_TO_MODIFY"
              value={newEffectKey}
              onChange={(e) => setNewEffectKey(e.target.value)}
            />
            <input 
              className="w-20 bg-black text-white border border-diesel-border p-2 text-xs font-mono focus:border-diesel-gold outline-none"
              placeholder="+/- VAL"
              value={newEffectValue}
              onChange={(e) => setNewEffectValue(e.target.value)}
            />
            <button 
              onClick={handleAddEffect}
              className="bg-diesel-gold/20 text-diesel-gold border border-diesel-gold px-3 text-xs hover:bg-diesel-gold hover:text-black font-bold"
            >
              ADD
            </button>
         </div>

         <div className="space-y-1">
           {item.effects.map((effect, idx) => (
             <div key={idx} className="flex justify-between items-center p-2 bg-black border border-diesel-border text-xs font-mono">
                <span className="text-diesel-paper">{effect.variable}</span>
                <div className="flex items-center gap-3">
                  <span className="text-diesel-gold font-bold">{String(effect.value)}</span>
                  <button onClick={() => handleRemoveEffect(idx)} className="text-diesel-rust hover:text-white"><Trash2 size={12}/></button>
                </div>
             </div>
           ))}
           {item.effects.length === 0 && <div className="text-diesel-steel text-[10px] italic text-center">No modifiers configured.</div>}
         </div>
      </div>
      
    </div>
  );
};