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
    <div className="flex flex-col items-center justify-center min-h-screen bg-nomadia-blue-bg-soft text-nomadia-blue p-4 font-sans">
      <header className="w-full max-w-4xl flex justify-between items-center mb-8">
        <img src="/logo-nomadia.svg" alt="Nomadia Logo" className="h-12" />
        <div className="bg-nomadia-green-bg px-4 py-1 rounded-full text-nomadia-green text-xs font-bold uppercase tracking-wider">
          Smart Mobility Duel
        </div>
      </header>

      <AnimatePresence mode="wait">
        {gameState === 'START' && (
          <motion.div 
            key="start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center space-y-8 border border-nomadia-blue/5 p-12 bg-white rounded-2xl shadow-xl max-w-2xl w-full"
          >
            <h1 className="text-5xl md:text-7xl font-display text-nomadia-blue">
              Barbarian <span className="text-nomadia-green italic">Nomadia</span>
            </h1>
            <div className="flex justify-center gap-4">
              <Swords size={48} className="text-nomadia-green" />
            </div>
            <p className="text-lg leading-relaxed text-nomadia-blue/70">
              Maîtrisez la mobilité, dominez le duel.<br/>
              Une expérience rétro aux couleurs de l'innovation.
            </p>
            
            <div className="grid grid-cols-2 gap-4 text-left text-sm">
              <div className="bg-nomadia-blue-bg p-4 rounded-xl">
                <p className="font-bold text-nomadia-blue mb-2">DÉPLACEMENT</p>
                <p className="text-nomadia-blue/60">A / D : Gauche / Droite</p>
                <p className="text-nomadia-blue/60">S : Bloquer l'attaque</p>
              </div>
              <div className="bg-nomadia-green-bg p-4 rounded-xl">
                <p className="font-bold text-nomadia-green mb-2">COMBAT</p>
                <p className="text-nomadia-green/70">Espace + ↑ : Coup Haut</p>
                <p className="text-nomadia-green/70">Espace + ↓ : Coup Bas</p>
                <p className="text-nomadia-green/70">Espace : Attaque Tournoyante</p>
              </div>
            </div>

            <button 
              onClick={startGame}
              className="w-full py-4 bg-nomadia-green text-white font-bold rounded-xl hover:bg-nomadia-green-dark transition-all shadow-lg shadow-nomadia-green/20 active:scale-95"
            >
              COMMENCER LE DUEL
            </button>
          </motion.div>
        )}

        {gameState === 'PLAYING' && (
          <motion.div 
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative border-4 border-nomadia-blue rounded-3xl overflow-hidden shadow-2xl bg-nomadia-blue"
          >
            <canvas 
              ref={canvasRef} 
              width={CANVAS_WIDTH} 
              height={CANVAS_HEIGHT}
              className="w-full max-w-[960px] aspect-[1.6/1]"
              style={{ width: 'min(90vw, 960px)' }}
            />
            <div className="absolute top-4 left-0 right-0 flex justify-between px-8 pointer-events-none">
              <div className="text-nomadia-green-light font-retro text-[10px]">P1: NOMADIA</div>
              <div className="text-nomadia-orange-accent font-retro text-[10px]">P2: CONCURRENT</div>
            </div>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div 
            key="gameover"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6 border border-nomadia-blue/5 p-12 bg-white rounded-2xl shadow-xl"
          >
            {winner === 1 ? (
              <Trophy size={64} className="mx-auto text-nomadia-green" />
            ) : (
              <Skull size={64} className="mx-auto text-nomadia-blue/30" />
            )}
            <h2 className="text-4xl font-display text-nomadia-blue">
              {winner === 1 ? "Victoire Nomadia !" : "Échec de la Mission"}
            </h2>
            <p className="text-nomadia-blue/60">
              {winner === 1 
                ? "Vous avez optimisé votre trajectoire vers la victoire." 
                : "L'adversaire a pris l'avantage sur le terrain."}
            </p>
            <button 
              onClick={startGame}
              className="px-12 py-4 bg-nomadia-blue text-white font-bold rounded-xl hover:bg-nomadia-blue-alt transition-all"
            >
              REPRENDRE LE DÉFI
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-12 text-xs text-nomadia-blue/40 flex flex-col items-center gap-2">
        <div className="flex gap-4">
          <span>© 2026 Nomadia Group</span>
          <span>•</span>
          <span>Smart Mobility Solutions</span>
        </div>
        <p className="italic">L'Hirondelle ne déforme jamais ses proportions.</p>
      </footer>
    </div>
  );
}
