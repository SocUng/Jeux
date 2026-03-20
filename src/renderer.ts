import { Character, PlayerState } from './types';

const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 200; // Classic Amstrad resolution-ish
const SCALE = 3;

export function drawGame(ctx: CanvasRenderingContext2D, p1: Character, p2: Character) {
  // Clear background
  ctx.fillStyle = '#000080'; // Dark blue background
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw ground
  ctx.fillStyle = '#008000'; // Green grass
  ctx.fillRect(0, 160, CANVAS_WIDTH, 40);
  
  // Draw UI
  drawUI(ctx, p1, p2);

  // Draw Characters
  drawCharacter(ctx, p1);
  drawCharacter(ctx, p2);
}

function drawUI(ctx: CanvasRenderingContext2D, p1: Character, p2: Character) {
  ctx.fillStyle = '#FFFF00';
  ctx.font = '8px "Press Start 2P"';
  
  // Player 1 Health
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i < p1.health ? '#FF0000' : '#440000';
    ctx.beginPath();
    ctx.arc(20 + i * 10, 20, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player 2 Health
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i < p2.health ? '#FF0000' : '#440000';
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH - 20 - i * 10, 20, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCharacter(ctx: CanvasRenderingContext2D, char: Character) {
  const { x, y } = char.pos;
  const dir = char.direction;
  const state = char.state;
  const frame = char.frame;
  
  ctx.save();
  ctx.translate(x, y);
  if (dir === -1) {
    ctx.scale(-1, 1);
  }

  // Animation offset
  let bob = 0;
  if (state === PlayerState.WALKING) {
    bob = Math.sin(Date.now() / 100) * 2;
  }

  // Skin (Tanned/Golden)
  ctx.fillStyle = '#FFD700'; 
  
  // Body (Muscular torso)
  ctx.fillRect(-8, -40 + bob, 16, 24);
  // Pecs/Abs detail
  ctx.fillStyle = '#DAA520';
  ctx.fillRect(-6, -36 + bob, 5, 2);
  ctx.fillRect(1, -36 + bob, 5, 2);
  
  // Head
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(-6, -52 + bob, 12, 12);
  
  // Eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(2, -48 + bob, 2, 2);

  // Hair (Black/Long)
  ctx.fillStyle = '#000';
  ctx.fillRect(-7, -54 + bob, 14, 6); // Top
  ctx.fillRect(-7, -48 + bob, 4, 12); // Back hair
  
  // Loincloth (Red)
  ctx.fillStyle = '#FF0000';
  ctx.fillRect(-9, -18 + bob, 18, 12);
  ctx.fillStyle = '#8B0000'; // Darker red detail
  ctx.fillRect(-9, -10 + bob, 18, 2);

  // Legs
  ctx.fillStyle = '#FFD700';
  if (state === PlayerState.WALKING) {
    const legOffset = Math.sin(Date.now() / 100) * 6;
    ctx.fillRect(-6 + legOffset/2, -8, 5, 8);
    ctx.fillRect(2 - legOffset/2, -8, 5, 8);
  } else {
    ctx.fillRect(-7, -8, 6, 8);
    ctx.fillRect(1, -8, 6, 8);
  }

  // Boots (Brown)
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(-8, -2, 8, 4);
  ctx.fillRect(0, -2, 8, 4);

  // Arms
  ctx.fillStyle = '#FFD700';
  drawArms(ctx, char, bob);

  // Sword
  ctx.fillStyle = '#FFFFFF';
  drawSword(ctx, char, bob);

  // Hit effect
  if (state === PlayerState.HIT) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(-15, -60, 30, 70);
  }

  ctx.restore();
}

function drawArms(ctx: CanvasRenderingContext2D, char: Character, bob: number) {
  const state = char.state;
  ctx.fillStyle = '#FFD700';

  switch (state) {
    case PlayerState.ATTACKING_HIGH:
      ctx.fillRect(0, -55 + bob, 4, 20); // Arm up
      break;
    case PlayerState.ATTACKING_LOW:
      ctx.fillRect(4, -25 + bob, 15, 4); // Arm forward
      break;
    case PlayerState.BLOCKING:
      ctx.fillRect(0, -45 + bob, 12, 4); // Arm across
      break;
    default:
      ctx.fillRect(6, -35 + bob, 4, 15); // Arm down
  }
}

function drawSword(ctx: CanvasRenderingContext2D, char: Character, bob: number) {
  const state = char.state;
  
  ctx.fillStyle = '#FFFFFF'; // Blade
  const hiltColor = '#8B4513';

  switch (state) {
    case PlayerState.IDLE:
    case PlayerState.WALKING:
      ctx.fillRect(8, -50 + bob, 2, 25); // Vertical
      ctx.fillStyle = hiltColor;
      ctx.fillRect(6, -25 + bob, 6, 2); // Guard
      break;
    case PlayerState.ATTACKING_HIGH:
      ctx.save();
      ctx.translate(2, -55 + bob);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-1, -30, 2, 30);
      ctx.restore();
      break;
    case PlayerState.ATTACKING_LOW:
      ctx.fillRect(15, -25 + bob, 30, 2);
      ctx.fillStyle = hiltColor;
      ctx.fillRect(15, -27 + bob, 2, 6);
      break;
    case PlayerState.ATTACKING_SPIN:
      const spinAngle = (Date.now() / 50) % (Math.PI * 2);
      ctx.save();
      ctx.rotate(spinAngle);
      ctx.fillRect(0, -30, 2, 30);
      ctx.restore();
      break;
    case PlayerState.BLOCKING:
      ctx.fillRect(10, -55 + bob, 2, 30);
      ctx.fillStyle = hiltColor;
      ctx.fillRect(8, -25 + bob, 6, 2);
      break;
    default:
      ctx.fillRect(8, -50 + bob, 2, 25);
  }
}
