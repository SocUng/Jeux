/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { Character, PlayerState } from './types';
import { drawGame } from './renderer';
import { Trophy, Skull, Swords, List } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getLeaderboard, saveScore, ScoreEntry, isSupabaseConfigured } from './supabase';

const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 200;
const GROUND_Y = 160;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER' | 'LEADERBOARD' | 'VICTORY'>('START');
  const [winner, setWinner] = useState<number | null>(null);
  const [p1, setP1] = useState(new Character(1, 60, GROUND_Y, 1));
  const [p2, setP2] = useState(new Character(2, 260, GROUND_Y, -1, true));
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [playerName, setPlayerName] = useState('BARBARIAN');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  
  const keys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current.add(e.code);
      if (e.code === 'Escape' && gameState === 'PLAYING') {
        setGameState('START');
      }
      if (e.code === 'Enter' && (gameState === 'START' || gameState === 'GAMEOVER')) {
        startGame();
      }
      if (e.code === 'Enter' && gameState === 'VICTORY') {
        nextRound();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'LEADERBOARD') {
      getLeaderboard().then(setLeaderboard);
    }
  }, [gameState]);

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
        handleGameOver(2);
      } else if (p2.health <= 0) {
        handleGameOver(1);
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

  const handleGameOver = async (winnerId: number) => {
    if (winnerId === 1) {
      const roundScore = 500 + p1.health * 50;
      setScore(prev => prev + roundScore);
      setGameState('VICTORY');
      await saveScore(playerName, roundScore);
    } else {
      setGameState('GAMEOVER');
      setWinner(winnerId);
    }
  };

  const nextRound = () => {
    setRound(prev => prev + 1);
    setP1(new Character(1, 60, GROUND_Y, 1));
    setP2(new Character(2, 260, GROUND_Y, -1, true));
    setGameState('PLAYING');
  };

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
    if (currentKeys.has('ArrowLeft')) {
      char.pos.x -= 2;
      char.direction = -1;
      moving = true;
    }
    if (currentKeys.has('ArrowRight')) {
      char.pos.x += 2;
      char.direction = 1;
      moving = true;
    }

    // Boundaries
    char.pos.x = Math.max(20, Math.min(CANVAS_WIDTH - 20, char.pos.x));

    // Combat
    if (currentKeys.has('Enter')) {
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
          if (attacker.state === PlayerState.ATTACKING_HIGH && dist < 30 && Math.random() < 0.2) {
            damage = 3;
          } else if (attacker.state === PlayerState.ATTACKING_SPIN) {
            damage = 2;
          }

          defender.health -= damage;
          defender.state = PlayerState.HIT;
          defender.stateTimer = 15;
          defender.pos.x += attacker.direction * 15;
        } else {
          attacker.state = PlayerState.HIT;
          attacker.stateTimer = 10;
          attacker.pos.x -= attacker.direction * 5;
        }
      }
    }
  };

  const startGame = () => {
    setScore(0);
    setRound(1);
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
            <div className="space-y-2">
              <p className="text-xs">ENTER YOUR NAME:</p>
              <input 
                type="text" 
                value={playerName} 
                onChange={(e) => setPlayerName(e.target.value.toUpperCase().slice(0, 10))}
                className="bg-black border-2 border-[#0f0] text-[#0f0] p-2 text-center w-full outline-none"
              />
            </div>
            <div className="space-y-4 text-xs md:text-sm text-cyan-400">
              <p>← / →: MOVE | S: BLOCK</p>
              <p>ENTER + ↑: HIGH CHOP | ENTER + ↓: LOW SLASH</p>
            </div>
            <div className="flex flex-col gap-4">
              <button 
                onClick={startGame}
                className="px-8 py-4 bg-red-600 text-white hover:bg-red-500 transition-colors border-4 border-white active:translate-y-1"
              >
                PRESS TO START
              </button>
              <button 
                onClick={() => setGameState('LEADERBOARD')}
                className="flex items-center justify-center gap-2 text-xs text-yellow-400 hover:underline"
              >
                <List size={16} /> VIEW LEADERBOARD
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'PLAYING' && (
          <motion.div 
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative border-8 border-gray-800 shadow-2xl"
          >
            <div className="absolute -top-12 left-0 right-0 flex justify-between items-center bg-black/50 p-2">
              <button 
                onClick={() => setGameState('START')}
                className="text-[10px] text-red-500 hover:text-red-400 border border-red-500 px-2 py-1 bg-black"
              >
                QUIT GAME [ESC]
              </button>
              <div className="text-[10px] text-cyan-400">
                ENTER TO ATTACK
              </div>
            </div>
            <canvas 
              ref={canvasRef} 
              width={CANVAS_WIDTH} 
              height={CANVAS_HEIGHT}
              className="w-full max-w-[960px] aspect-[1.6/1] bg-blue-900"
              style={{ width: 'min(90vw, 960px)' }}
            />
            <div className="absolute top-4 left-0 right-0 flex justify-between px-8 pointer-events-none">
              <div className="text-white text-[8px] md:text-[10px]">P1: {playerName} | SCORE: {score}</div>
              <div className="text-white text-[8px] md:text-[10px]">P2: DRAX | ROUND: {round}</div>
            </div>
          </motion.div>
        )}

        {gameState === 'VICTORY' && (
          <motion.div 
            key="victory"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8 border-4 border-yellow-400 p-12 bg-[#000080] shadow-[8px_8px_0px_#0f0]"
          >
            <h2 className="text-4xl text-yellow-400">VICTORY!</h2>
            <div className="space-y-2">
              <p className="text-xl">ROUND {round} COMPLETE</p>
              <p className="text-2xl text-cyan-400">TOTAL SCORE: {score}</p>
            </div>
            <button 
              onClick={nextRound}
              className="w-full py-4 bg-yellow-400 text-[#000080] font-bold hover:bg-yellow-300 transition-colors"
            >
              NEXT ROUND [ENTER]
            </button>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div 
            key="gameover"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8 border-4 border-red-500 p-12 bg-[#000080] shadow-[8px_8px_0px_#f00]"
          >
            <Skull size={64} className="mx-auto text-red-600 animate-pulse" />
            <h2 className="text-4xl text-red-500">DEFEAT</h2>
            <div className="space-y-2">
              <p className="text-xl">FINAL SCORE: {score}</p>
            </div>
            <div className="flex flex-col gap-4">
              <button 
                onClick={startGame}
                className="w-full py-4 bg-red-500 text-white font-bold hover:bg-red-400 transition-colors"
              >
                TRY AGAIN [ENTER]
              </button>
              <button 
                onClick={() => setGameState('LEADERBOARD')}
                className="w-full py-4 border-2 border-red-500 text-red-500 font-bold hover:bg-red-500/10 transition-colors"
              >
                LEADERBOARD
              </button>
              <button 
                onClick={() => setGameState('START')}
                className="text-xs text-cyan-400 hover:underline"
              >
                BACK TO MENU
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'LEADERBOARD' && (
          <motion.div 
            key="leaderboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-8 border-4 border-yellow-400 p-12 bg-[#000080] shadow-[8px_8px_0px_#0f0] max-w-md w-full"
          >
            <h2 className="text-2xl text-yellow-400">HALL OF FAME</h2>
            {!isSupabaseConfigured && (
              <div className="p-4 border-2 border-red-500 bg-red-900/20 text-red-500 text-[10px] mb-4">
                SUPABASE NOT CONFIGURED.<br/>
                SET VITE_SUPABASE_URL AND VITE_SUPABASE_ANON_KEY IN SECRETS.
              </div>
            )}
            <div className="space-y-4 text-left">
              {leaderboard.length > 0 ? leaderboard.map((entry, i) => (
                <div key={i} className="flex justify-between border-b border-cyan-900 pb-1 text-xs">
                  <span>{i + 1}. {entry.player_name}</span>
                  <span className="text-yellow-400">{entry.score}</span>
                </div>
              )) : <p className="text-center text-xs opacity-50">NO SCORES YET</p>}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => getLeaderboard().then(setLeaderboard)}
                className="flex-1 py-2 bg-cyan-600 text-white text-xs border-2 border-white"
              >
                REFRESH
              </button>
              <button 
                onClick={() => setGameState('START')}
                className="flex-1 py-2 bg-red-600 text-white text-xs border-2 border-white"
              >
                BACK
              </button>
            </div>
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
