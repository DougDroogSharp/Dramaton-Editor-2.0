
import { GameData, SfxCategory, SfxType } from './types';

export const INITIAL_GAME_DATA: GameData = {
  info: { 
    title: "", 
    author: "",
    worldState: {
      // Empty by default for game-agnostic creation
    },
    styleGuide: null,
    customPoses: [],
    customExpressions: [],
    gameMode: 'INTERACTIVE',
    titleSceneId: undefined,
    enableAutosave: true // Enabled by default
  },
  actors: [],
  scenes: [],
  drops: [], // Was screens
  items: [],
  sfx: []
};

export const EXPRESSIONS = [
  'Neutral',
  'Happy',
  'Angry',
  'Confused',
  'Flirting',
  'Sad',
  'Surprised',
  'Disgusted'
];

export const POSES = [
  'Close-up',
  'Full Body',
  'Jump',
  'Run',
  'Wave',
  'Pointing',
  'Crouch',
  'Dead'
];

export const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export const SCENE_TYPES = {
  AGENCY: 'AGENCY',
  WITNESS: 'WITNESS'
} as const;

export const WITNESS_REACTIONS = [
  { label: 'CHEER', color: 'border-green-500 text-green-500' },
  { label: 'BOO', color: 'border-red-500 text-red-500' },
  { label: 'SILENCE', color: 'border-gray-500 text-gray-500' },
  { label: 'WALK AWAY', color: 'border-yellow-500 text-yellow-500' }
];

export const SFX_CATEGORIES: Record<string, SfxCategory> = {
  ATTACH: 'ATTACH',
  DO: 'DO'
};

export const SFX_TYPES: Record<SfxCategory, SfxType[]> = {
  ATTACH: ['pulse', 'jiggle', 'glow', 'electric'],
  DO: ['shake', 'fade']
};

export const ITEM_CATEGORIES = ['costume', 'prop', 'knowledge', 'gear'];
export const ACQUISITION_TYPES = ['pickup', 'earned'];
export const OPERATORS = ['>', '<', '>=', '<=', '=='];
