/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { Character, PlayerState } from './types';
import { drawGame } from './renderer';
import { Sword, Shield, Trophy, Skull, Swords } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 200;
const GROUND_Y = 160;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [winner, setWinner] = useState<number | null>(null);
  const [p1, setP1] = useState(new Character(1, 60, GROUND_Y, 1));
  const [p2, setP2] = useState(new Character(2, 260, GROUND_Y, -1, true));
  
  const keys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keys.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    let animationFrameId: number;
    let lastTime = 0;

    const loop = (time: number) => {
      const dt = time - lastTime;
      if (dt > 16) { // Cap at ~60fps
        update(dt);
        render();
        lastTime = time;
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    const update = (dt: number) => {
      // Update P1
      updateCharacter(p1, keys.current, p2);
      // Update P2 (CPU)
      updateCPU(p2, p1);
      
      // Collision Detection
      checkCombat(p1, p2);
      checkCombat(p2, p1);

      // Win condition
      if (p1.health <= 0) {
        setGameState('GAMEOVER');
        setWinner(2);
      } else if (p2.health <= 0) {
        setGameState('GAMEOVER');
        setWinner(1);
      }

      setP1({ ...p1 });
      setP2({ ...p2 });
    };

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawGame(ctx, p1, p2);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, p1, p2]);

  const updateCharacter = (char: Character, currentKeys: Set<string>, opponent: Character) => {
    if (char.state === PlayerState.HIT || char.state === PlayerState.DEAD) {
      char.stateTimer -= 1;
      if (char.stateTimer <= 0) char.state = PlayerState.IDLE;
      return;
    }

    // Reset state if timer finished
    if (char.stateTimer > 0) {
      char.stateTimer -= 1;
      if (char.stateTimer <= 0) char.state = PlayerState.IDLE;
      return;
    }

    // Movement
    let moving = false;
    if (currentKeys.has('KeyA')) {
      char.pos.x -= 2;
      char.direction = -1;
      moving = true;
    }
    if (currentKeys.has('KeyD')) {
      char.pos.x += 2;
      char.direction = 1;
      moving = true;
    }

    // Boundaries
    char.pos.x = Math.max(20, Math.min(CANVAS_WIDTH - 20, char.pos.x));

    // Combat
    if (currentKeys.has('Space')) {
      if (currentKeys.has('ArrowUp')) {
        char.state = PlayerState.ATTACKING_HIGH;
        char.stateTimer = 20;
      } else if (currentKeys.has('ArrowDown')) {
        char.state = PlayerState.ATTACKING_LOW;
        char.stateTimer = 20;
      } else {
        char.state = PlayerState.ATTACKING_SPIN;
        char.stateTimer = 30;
      }
    } else if (currentKeys.has('KeyS')) {
      char.state = PlayerState.BLOCKING;
      char.stateTimer = 10;
    } else if (moving) {
      char.state = PlayerState.WALKING;
    } else {
      char.state = PlayerState.IDLE;
    }
  };

  const updateCPU = (cpu: Character, player: Character) => {
    if (cpu.stateTimer > 0) {
      cpu.stateTimer -= 1;
      if (cpu.stateTimer <= 0) cpu.state = PlayerState.IDLE;
      return;
    }

    const dist = Math.abs(cpu.pos.x - player.pos.x);
    cpu.direction = cpu.pos.x > player.pos.x ? -1 : 1;

    if (dist > 50) {
      cpu.pos.x += cpu.direction * 1.5;
      cpu.state = PlayerState.WALKING;
    } else {
      // Random attack
      const rand = Math.random();
      if (rand < 0.05) {
        cpu.state = PlayerState.ATTACKING_HIGH;
        cpu.stateTimer = 20;
      } else if (rand < 0.1) {
        cpu.state = PlayerState.ATTACKING_LOW;
        cpu.stateTimer = 20;
      } else if (rand < 0.12) {
        cpu.state = PlayerState.BLOCKING;
        cpu.stateTimer = 15;
      } else {
        cpu.state = PlayerState.IDLE;
      }
    }
  };

  const checkCombat = (attacker: Character, defender: Character) => {
    if (attacker.stateTimer !== 10) return; // Check hit at specific frame

    const dist = Math.abs(attacker.pos.x - defender.pos.x);
    if (dist < 45) {
      const isBlocked = defender.state === PlayerState.BLOCKING && defender.direction !== attacker.direction;
      
      if (attacker.state === PlayerState.ATTACKING_HIGH || attacker.state === PlayerState.ATTACKING_LOW || attacker.state === PlayerState.ATTACKING_SPIN) {
        if (!isBlocked) {
          let damage = 1;
          // Critical hit chance for high chop at close range
          if (attacker.state === PlayerState.ATTACKING_HIGH && dist < 30 && Math.random() < 0.2) {
            damage = 3; // Massive damage (simulating neck chop)
          } else if (attacker.state === PlayerState.ATTACKING_SPIN) {
            damage = 2;
          }

          defender.health -= damage;
          defender.state = PlayerState.HIT;
          defender.stateTimer = 15;
          // Push back
          defender.pos.x += attacker.direction * 15;
          
          // Screen shake effect could be added here if we had a camera system
        } else {
          // Blocked!
          attacker.state = PlayerState.HIT; // Attacker is slightly stunned
          attacker.stateTimer = 10;
          attacker.pos.x -= attacker.direction * 5;
        }
      }
    }
  };

  const startGame = () => {
    setP1(new Character(1, 60, GROUND_Y, 1));
    setP2(new Character(2, 260, GROUND_Y, -1, true));
    setGameState('PLAYING');
    setWinner(null);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-[#0f0] p-4 font-retro">
      <AnimatePresence mode="wait">
        {gameState === 'START' && (
          <motion.div 
            key="start"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="text-center space-y-8 border-4 border-[#0f0] p-12 bg-[#000080] shadow-[8px_8px_0px_#0f0]"
          >
            <h1 className="text-4xl md:text-6xl text-yellow-400 drop-shadow-[4px_4px_0px_#f00]">
              BARBARIAN
            </h1>
            <div className="flex justify-center gap-4">
              <Swords size={48} className="text-red-500" />
            </div>
            <p className="text-sm md:text-base leading-relaxed">
              THE ULTIMATE DUEL<br/>
              AMSTRAD CPC EDITION
            </p>
            <div className="space-y-4 text-xs md:text-sm text-cyan-400">
              <p>CONTROLS:</p>
              <p>A/D: MOVE | S: BLOCK</p>
              <p>SPACE + UP: HIGH CHOP</p>
              <p>SPACE + DOWN: LOW SLASH</p>
              <p>SPACE: SPIN ATTACK</p>
            </div>
            <button 
              onClick={startGame}
              className="px-8 py-4 bg-red-600 text-white hover:bg-red-500 transition-colors border-4 border-white active:translate-y-1"
            >
              PRESS TO START
            </button>
          </motion.div>
        )}

        {gameState === 'PLAYING' && (
          <motion.div 
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative border-8 border-gray-800 shadow-2xl"
          >
            <canvas 
              ref={canvasRef} 
              width={CANVAS_WIDTH} 
              height={CANVAS_HEIGHT}
              className="w-full max-w-[960px] aspect-[1.6/1] bg-blue-900"
              style={{ width: 'min(90vw, 960px)' }}
            />
            <div className="absolute top-4 left-0 right-0 flex justify-between px-8 pointer-events-none">
              <div className="text-white text-xs">P1: BARBARIAN</div>
              <div className="text-white text-xs">P2: DRAX</div>
            </div>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div 
            key="gameover"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6 border-4 border-red-600 p-12 bg-black"
          >
            <Skull size={64} className="mx-auto text-red-600 animate-pulse" />
            <h2 className="text-4xl text-red-600">GAME OVER</h2>
            <p className="text-xl">
              {winner === 1 ? "PLAYER 1 WINS!" : "CPU WINS!"}
            </p>
            <button 
              onClick={startGame}
              className="px-8 py-4 bg-[#0f0] text-black hover:bg-[#4f4] transition-colors"
            >
              REMATCH?
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-8 text-[10px] opacity-50 text-center">
        © 1987 PALACE SOFTWARE (REIMAGINED)<br/>
        MODE 0 GRAPHICS EMULATION
      </footer>
    </div>
  );
}
