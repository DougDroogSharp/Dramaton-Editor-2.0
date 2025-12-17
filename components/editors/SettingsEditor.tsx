import React, { useState } from 'react';
import { Upload, Globe, ImageIcon, Trash2, PlayCircle, Gamepad2, Key, RefreshCw, Zap, Save, Check, AlertTriangle, Database, LayoutTemplate, Info, Palette } from 'lucide-react';
import { GameData, GameInfo } from '../../types';
import { CyberInput } from '../CyberInput';
import { speak } from '../../utils/voice';
import { fetchVoices } from '../../utils/elevenlabs';

interface SettingsEditorProps {
  game: GameData;
  onUpdateInfo: (field: keyof GameInfo, value: any) => void;
  onUpdateWorldState: (key: string, value: string | number | boolean) => void;
  onDeleteWorldState: (key: string) => void;
  onAddScene: () => void;
}

export const SettingsEditor: React.FC<SettingsEditorProps> = ({
  game,
  onUpdateInfo,
  onUpdateWorldState,
  onDeleteWorldState,
  onAddScene
}) => {
  const [newWorldKey, setNewWorldKey] = useState("");
  const [newWorldValue, setNewWorldValue] = useState("");
  const [valueType, setValueType] = useState<'string' | 'number' | 'boolean'>('string');
  
  // API Key Testing State
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [keyMessage, setKeyMessage] = useState("");

  const handleStyleGuideUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        onUpdateInfo('styleGuide', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveStyleGuide = () => {
    onUpdateInfo('styleGuide', null);
  };

  const handleTestApiKey = async () => {
    if (!game.info.elevenLabsApiKey || game.info.elevenLabsApiKey.length < 5) return;
    
    setIsTestingKey(true);
    setKeyStatus('idle');
    setKeyMessage("");

    try {
        const voices = await fetchVoices(game.info.elevenLabsApiKey);
        setKeyStatus('success');
        setKeyMessage(`Success! Found ${voices.length} voices.`);
    } catch (e: any) {
        setKeyStatus('error');
        if (e.message && e.message.toLowerCase().includes('invalid api key')) {
             setKeyMessage("Invalid API Key");
        } else if (e.message.includes('voices_read') || e.message.includes('permission')) {
             setKeyStatus('success'); // Technically a success for generation, just restricted listing
             setKeyMessage("Limited Access Key (Generation Only). Valid.");
        } else {
             setKeyMessage("Connection Failed. Check Key.");
        }
    } finally {
        setIsTestingKey(false);
    }
  };

  const handleAddWorldState = () => {
    if (newWorldKey.trim()) {
      let finalValue: string | number | boolean = newWorldValue;
      if (valueType === 'number') {
         finalValue = Number(newWorldValue);
         if (isNaN(finalValue)) finalValue = 0;
      } else if (valueType === 'boolean') {
         finalValue = newWorldValue.toLowerCase() === 'true';
      }

      onUpdateWorldState(newWorldKey.trim(), finalValue);
      setNewWorldKey("");
      setNewWorldValue("");
      // Reset type for next entry? No, keep logic simple.
    }
  };

  return (
    <div className="animate-fade-in pb-20 pt-6">
      <h2 className="text-2xl font-bold mb-6 text-diesel-gold border-b border-diesel-gold/30 pb-2">
        GAME EDITOR
      </h2>
      <CyberInput 
        label="GAME TITLE" 
        value={game.info.title}
        onChange={(e) => onUpdateInfo('title', e.target.value)}
      />
      <CyberInput 
        label="Author / Architect" 
        value={game.info.author}
        onChange={(e) => onUpdateInfo('author', e.target.value)}
      />

      {/* START SCENE SELECTOR */}
      <div className="mb-6 bg-diesel-dark p-3 border border-diesel-border mt-4">
         <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold text-diesel-paper uppercase flex items-center gap-2">
              <LayoutTemplate size={14} className="text-diesel-gold" />
              Title Scene (Entry Point)
            </h3>
            <span className="text-[10px] text-diesel-steel font-mono">
                {game.scenes.length} AVAILABLE
            </span>
         </div>
         
         <select
            className="w-full bg-diesel-black text-diesel-gold border border-diesel-border p-2 text-xs focus:outline-none hover:border-diesel-gold transition-colors cursor-pointer font-mono font-bold"
            value={game.info.titleSceneId || ""}
            onChange={(e) => {
               if (e.target.value === "NEW_SCENE") {
                  onAddScene();
               } else {
                  onUpdateInfo('titleSceneId', e.target.value);
               }
            }}
         >
            <option value="NEW_SCENE" className="text-diesel-green font-bold bg-diesel-dark">+ CREATE NEW SCENE</option>
            <option value="" className="text-diesel-steel bg-diesel-black">-- SELECT TITLE SCENE --</option>
            {game.scenes.map(scene => (
               <option key={scene.id} value={scene.id} className="text-diesel-gold bg-diesel-black">
                  {scene.name}
               </option>
            ))}
         </select>
         
         {game.scenes.length > 0 && (
            <div className="text-[10px] text-diesel-steel mt-2 italic flex items-start gap-1.5">
               <Info size={12} className="shrink-0 mt-0.5" />
               <span>This scene will load automatically when the player clicks INITIALIZE on the main menu.</span>
            </div>
         )}
      </div>

      <div className="mt-4 bg-diesel-dark p-3 border border-diesel-border">
        <h3 className="text-xs font-bold text-diesel-paper uppercase flex items-center gap-2 mb-2">
           <Key size={14} className="text-diesel-gold" />
           External Modules (ElevenLabs)
        </h3>
        
        <div className="flex gap-2 items-end">
           <div className="flex-1">
             <CyberInput 
               label="API Key" 
               value={game.info.elevenLabsApiKey || ""}
               onChange={(e) => {
                 onUpdateInfo('elevenLabsApiKey', e.target.value);
                 setKeyStatus('idle'); // Reset status on edit
               }}
               onBlur={handleTestApiKey}
               placeholder="sk_..."
               type="password"
               className="mb-0"
             />
           </div>
           <button 
             onClick={handleTestApiKey}
             disabled={!game.info.elevenLabsApiKey || isTestingKey}
             className={`h-[38px] px-3 mb-2 border text-xs font-bold transition-all flex items-center gap-2
                 ${!game.info.elevenLabsApiKey 
                    ? 'bg-diesel-dark text-diesel-steel border-diesel-border' 
                    : 'bg-diesel-gold/20 text-diesel-gold border-diesel-gold hover:bg-diesel-gold hover:text-black'}
             `}
           >
             {isTestingKey ? <RefreshCw size={14} className="animate-spin"/> : <Zap size={14} />}
             VERIFY
           </button>
        </div>

        {/* Status Message */}
        {keyStatus !== 'idle' && (
           <div className={`mt-2 text-[10px] font-bold flex items-center gap-2 p-2 border ${
              keyStatus === 'success' ? 'text-diesel-green border-diesel-green/30 bg-diesel-green/10' : 'text-diesel-rust border-diesel-rust/30 bg-diesel-rust/10'
           }`}>
              {keyStatus === 'success' ? <Check size={12} /> : <AlertTriangle size={12} />}
              {keyMessage}
           </div>
        )}
        
        <div className="mt-2 flex items-center gap-1 text-[9px] text-diesel-green">
           <Database size={10} /> 
           <span className="font-mono uppercase">Key is securely persisted in local storage.</span>
        </div>
      </div>

      {/* Game Mode Selection */}
      <div className="mt-8">
        <label className="text-xs uppercase tracking-widest text-diesel-gold font-bold mb-2 block">
          Gameplay Mode (Default)
        </label>
        <div className="flex gap-2">
           <button
             onClick={() => onUpdateInfo('gameMode', 'INTERACTIVE')}
             className={`flex-1 py-3 px-2 text-xs font-bold border transition-all flex flex-col items-center gap-2
               ${game.info.gameMode === 'INTERACTIVE' 
                 ? 'bg-diesel-gold text-black border-diesel-gold shadow-diesel-glow' 
                 : 'text-diesel-steel border-diesel-border hover:border-diesel-gold/50'}`}
           >
             <Gamepad2 size={18} />
             PLAYER CONTROL
           </button>
           <button
             onClick={() => onUpdateInfo('gameMode', 'AUTO_PLAY')}
             className={`flex-1 py-3 px-2 text-xs font-bold border transition-all flex flex-col items-center gap-2
               ${game.info.gameMode === 'AUTO_PLAY' 
                 ? 'bg-diesel-gold text-black border-diesel-gold shadow-diesel-glow' 
                 : 'text-diesel-steel border-diesel-border hover:border-diesel-gold/50'}`}
           >
             <PlayCircle size={18} />
             AUTO-PLAY
           </button>
        </div>
        <div className="text-[10px] text-diesel-steel mt-2 italic text-center">
          {game.info.gameMode === 'INTERACTIVE' 
            ? "Player makes decisions. Game waits for input." 
            : "Game plays itself if no input received (Cinematic Mode)."}
        </div>
      </div>

      {/* Style Guide Uploader - COMPACT VERSION */}
      <div className="mt-8 bg-diesel-dark p-3 border border-diesel-border">
         <div className="flex items-center gap-4">
            {/* Left: Thumbnail Preview */}
            <div className="w-16 h-16 bg-black border border-diesel-gold/30 relative group overflow-hidden shrink-0">
                {game.info.styleGuide ? (
                <img src={game.info.styleGuide} alt="Style Guide" className="w-full h-full object-cover" />
                ) : (
                <div className="absolute inset-0 flex items-center justify-center text-center p-1 text-[8px] text-diesel-steel">
                    NO STYLE
                </div>
                )}
                <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    <Upload size={16} className="text-diesel-gold" />
                    <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleStyleGuideUpload}
                    />
                </label>
            </div>

            {/* Right: Controls & Text */}
            <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-start mb-1">
                    <h3 className="text-xs font-bold text-diesel-paper uppercase flex items-center gap-2">
                        <ImageIcon size={14} className="text-diesel-gold" />
                        Master Visual Style
                    </h3>
                    {game.info.styleGuide && (
                        <button onClick={handleRemoveStyleGuide} className="text-diesel-rust hover:text-red-400 text-[9px] font-bold flex items-center gap-1 border border-diesel-rust/30 px-1.5 py-0.5 rounded">
                            <Trash2 size={10} /> CLEAR
                        </button>
                    )}
                 </div>
                 <p className="text-[10px] text-diesel-steel leading-tight">
                    Upload a reference image here to enforce a consistent art style across all generated assets (Actors, Items, Drops).
                 </p>
            </div>
         </div>
      </div>

      <div className="mt-8 bg-diesel-dark p-4 border border-diesel-border">
        <h3 className="text-xs font-bold text-diesel-paper mb-4 uppercase flex items-center gap-2">
          <Globe size={14} className="text-diesel-gold" />
          World State / Cassandra Feed
        </h3>
        
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex gap-2">
             <input 
               className="bg-black border border-diesel-border p-2 text-xs flex-1 text-diesel-gold font-mono focus:outline-none focus:border-diesel-gold font-bold"
               placeholder="VARIABLE_NAME"
               value={newWorldKey}
               onChange={(e) => setNewWorldKey(e.target.value)}
             />
             <select 
               className="bg-black border border-diesel-border p-2 text-xs text-white focus:outline-none font-bold"
               value={valueType}
               onChange={(e) => setValueType(e.target.value as any)}
             >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
             </select>
          </div>
          <div className="flex gap-2">
             {valueType === 'boolean' ? (
                <select 
                   className="bg-black border border-diesel-border p-2 text-xs flex-1 text-white font-mono focus:outline-none focus:border-diesel-gold font-bold"
                   value={newWorldValue}
                   onChange={(e) => setNewWorldValue(e.target.value)}
                >
                   <option value="">Select...</option>
                   <option value="true">True</option>
                   <option value="false">False</option>
                </select>
             ) : (
               <input 
                 className="bg-black border border-diesel-border p-2 text-xs flex-1 text-white font-mono focus:outline-none focus:border-diesel-gold"
                 placeholder="VALUE"
                 type={valueType === 'number' ? 'number' : 'text'}
                 value={newWorldValue}
                 onChange={(e) => setNewWorldValue(e.target.value)}
               />
             )}
            <button 
               onClick={handleAddWorldState}
               className="bg-diesel-gold/20 text-diesel-gold border border-diesel-gold px-3 text-xs hover:bg-diesel-gold hover:text-black font-bold"
            >
               ADD
            </button>
          </div>
        </div>

        <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
          {Object.entries(game.info.worldState).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center p-2 bg-black/50 text-xs font-mono border-l-2 border-diesel-gold/50">
              <span className="text-diesel-gold opacity-100">{key}</span>
              <div className="flex items-center gap-3">
                <span className={`text-white ${typeof value === 'boolean' ? (value ? 'text-diesel-green' : 'text-diesel-rust') : typeof value === 'number' ? 'text-blue-400' : ''}`}>
                  {String(value)}
                </span>
                <button 
                  onClick={() => onDeleteWorldState(key)}
                  className="text-diesel-rust hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {Object.keys(game.info.worldState).length === 0 && (
            <div className="text-center text-diesel-steel text-xs italic py-4">NO WORLD STATE VARIABLES DEFINED</div>
          )}
        </div>
      </div>
    </div>
  );
};