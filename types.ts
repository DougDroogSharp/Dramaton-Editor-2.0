
export interface WorldState {
  [key: string]: string | number | boolean;
}

export interface GameInfo {
  title: string;
  author: string;
  worldState: WorldState; 
  styleGuide: string | null; 
  customPoses: string[];
  customExpressions: string[];
  gameMode: 'INTERACTIVE' | 'AUTO_PLAY';
  elevenLabsApiKey?: string;
  enableAutosave?: boolean;
  titleSceneId?: string; // The scene to use as the Title Screen
}

export interface ActorGraphic {
  id: string;
  pose: string;
  expression: string;
  angle: number;
  image: string; // base64
}

export interface StageElement {
  id: string;        
  assetId: string;   
  type: 'ACTOR' | 'ITEM' | 'BALLOON';
  x: number;         
  y: number;         
  scale: number;     
  zIndex: number;    
  rotation: number;  
  pose?: string;
  expression?: string;
  spriteAngle?: number; // Visual angle of the sprite (0, 45, 90 etc)
  // Balloon specific
  text?: string;
  balloonType?: 'SPEECH' | 'THOUGHT';
  // SFX specific
  activeSfx?: string[]; // Array of SFX IDs currently applied
}

export interface Actor {
  id: string;
  name: string;
  image: string | null; 
  referenceImageCloseUp: string | null; 
  referenceImageFullBody: string | null; 
  graphics: ActorGraphic[]; 
  voiceId?: string; // ElevenLabs Voice ID
}

export type SceneType = 'AGENCY' | 'WITNESS';

export interface SceneRequirements {
  requiredWorldState?: { key: string; value: string | number | boolean }[];
}

export interface Scene {
  id: string;
  name: string;
  type: SceneType;
  script: string; 
  requirements: SceneRequirements;
  stage: StageElement[];
  audioData?: Record<string, string>; // key: line text, value: base64 audio
  dropId?: string; // Establishing Shot / Background (Was screenId)
}

export interface Drop { // Was Screen
  id: string;
  name: string;
  prompt: string;
  image: string | null;
}

export type ItemCategory = 'costume' | 'prop' | 'knowledge' | 'gear';
export type AcquisitionType = 'pickup' | 'earned';
export type Operator = '>' | '<' | '>=' | '<=' | '==';

export interface UnlockCondition {
  variable: string;
  operator: Operator;
  threshold: number | string | boolean;
}

export interface ItemEffect {
  variable: string;
  value: number | string | boolean;
}

export interface Item {
  id: string;
  name: string;
  description?: string; // Description for generation/flavor
  category: ItemCategory;
  acquisition: AcquisitionType;
  unlockCondition: UnlockCondition | null;
  effects: ItemEffect[];
  visualAsset: string | null;
}

export type SfxCategory = 'ATTACH' | 'DO';
export type SfxType = 'pulse' | 'jiggle' | 'glow' | 'shake' | 'fade' | 'electric';

export interface Sfx {
  id: string;
  name: string;
  category: SfxCategory;
  type: SfxType;
  prompt?: string;
  params: {
    intensity: number; 
    speed?: number; 
    color?: string; 
    duration?: number; 
  };
}

export interface GameData {
  info: GameInfo;
  actors: Actor[];
  scenes: Scene[];
  drops: Drop[]; // Was screens
  items: Item[];
  sfx: Sfx[];
}

export type SelectionType = 'settings' | 'actor' | 'scene' | 'drop' | 'item' | 'sfx' | null;

export interface SelectionState {
  type: SelectionType;
  id: string | null;
  subId?: string | null; // For selecting specific graphics/elements
  returnTo?: {
    type: SelectionType;
    id: string | null;
  };
}
export interface PreviewPanelProps {
  game: GameData;
  selection: SelectionState;
  isSimulating?: boolean;
  voiceEnabled: boolean;
  onNavigateToScene?: (sceneId: string) => void;
  onSaveGame?: () => void;
}
