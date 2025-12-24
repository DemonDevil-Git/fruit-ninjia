export enum GameState {
  LOADING = 'LOADING',
  START = 'START',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface HandPosition {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  isDetected: boolean;
}

export enum GameObjectType {
  EARTH = 'EARTH',
  WATERMELON = 'WATERMELON',
  POOP = 'POOP',
  BOMB = 'BOMB',
  BANANA = 'BANANA',
  GRAPE = 'GRAPE',
  MELON = 'MELON',
  TANGERINE = 'TANGERINE',
  CACTUS = 'CACTUS'
}

export interface GameObject {
  id: string;
  type: GameObjectType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotationSpeed: number;
  isSliced: boolean;
  scale: number;
  emoji: string;
  mesh?: any; // To hold Three.js object reference
}