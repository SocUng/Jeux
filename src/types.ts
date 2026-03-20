export enum PlayerState {
  IDLE,
  WALKING,
  ATTACKING_HIGH,
  ATTACKING_LOW,
  ATTACKING_SPIN,
  BLOCKING,
  KICKING,
  HIT,
  DEAD,
  DECAPITATED
}

export interface Position {
  x: number;
  y: number;
}

export interface GameState {
  p1: Character;
  p2: Character;
  isGameOver: boolean;
  winner: number | null;
  timer: number;
}

export class Character {
  id: number;
  pos: Position;
  state: PlayerState = PlayerState.IDLE;
  health: number = 12; // 12 dots like in the original
  direction: number; // 1 for right, -1 for left
  frame: number = 0;
  stateTimer: number = 0;
  isCPU: boolean;

  constructor(id: number, x: number, y: number, direction: number, isCPU: boolean = false) {
    this.id = id;
    this.pos = { x, y };
    this.direction = direction;
    this.isCPU = isCPU;
  }
}
