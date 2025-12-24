import React, { useState } from 'react';
import CameraFeed from './components/CameraFeed';
import GameCanvas from './components/GameCanvas';
import { GameState, HandPosition } from './types';
import { audioService } from './services/audioService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.LOADING);
  const [handPosition, setHandPosition] = useState<HandPosition>({ x: 0.5, y: 0.5, isDetected: false });
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);

  const handleCameraLoaded = () => {
    // Transition to START only if still loading
    setGameState(prev => prev === GameState.LOADING ? GameState.START : prev);
  };

  const handleRestart = () => {
    setScore(0);
    setLives(3);
    setGameState(GameState.START);
    audioService.playStart();
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#3e2723] font-sans text-white select-none">
      {/* Background Gradient (Wood Texture Colors) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#8d6e63] via-[#5d4037] to-[#3e2723] pointer-events-none"></div>

      {/* 3D Game Layer */}
      <GameCanvas 
        handPosition={handPosition} 
        gameState={gameState} 
        setGameState={setGameState}
        setScore={setScore}
        setLives={setLives}
      />

      {/* UI Overlay */}
      <div className="absolute inset-0 z-20 pointer-events-none p-6 flex flex-col justify-between">
        
        {/* HUD */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold tracking-tighter text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">
              NEON SLICE
            </h1>
            {gameState === GameState.PLAYING && (
              <div className="text-2xl font-mono text-yellow-300 drop-shadow-md">
                SCORE: {score.toString().padStart(4, '0')}
              </div>
            )}
          </div>
          
          {gameState === GameState.PLAYING && (
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <span 
                  key={i} 
                  className={`text-3xl transition-opacity drop-shadow-md ${i < lives ? 'opacity-100' : 'opacity-20 grayscale'}`}
                >
                  ❤️
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Center Messages */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
          {gameState === GameState.LOADING && (
            <div className="text-center animate-pulse">
              <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-xl text-cyan-200 drop-shadow-md">INITIALIZING VISION...</h2>
              <p className="text-sm text-cyan-100/70">Please allow camera access</p>
            </div>
          )}

          {gameState === GameState.START && (
            <div className="text-center bg-black/40 p-8 rounded-2xl backdrop-blur-sm border border-cyan-500/30 shadow-xl">
              <h2 className="text-3xl font-bold mb-4 text-white drop-shadow-md">READY?</h2>
              <p className="text-cyan-300 text-lg mb-2 drop-shadow-sm">Raise your hand to connect.</p>
              <p className="text-white animate-bounce drop-shadow-md">Slice the <span className="text-blue-400 font-bold">EARTH</span> to start!</p>
            </div>
          )}

          {gameState === GameState.GAME_OVER && (
            <div className="text-center bg-black/80 p-10 rounded-2xl border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]">
              <h2 className="text-5xl font-black text-red-500 mb-2 drop-shadow-lg">GAME OVER</h2>
              <div className="text-3xl text-white mb-6 drop-shadow-md">FINAL SCORE: {score}</div>
              <button 
                onClick={handleRestart}
                className="pointer-events-auto px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full text-xl transition-transform hover:scale-105 active:scale-95 shadow-lg"
              >
                RESTART
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Input Handling */}
      <CameraFeed 
        onHandUpdate={setHandPosition} 
        onLoaded={handleCameraLoaded}
      />
    </div>
  );
};

export default App;