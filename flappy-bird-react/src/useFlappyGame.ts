import { useState, useEffect, useRef, useCallback } from 'react';
import { saveScore } from './firebase';

interface Pipe {
  id: number;
  left: number;
  topHeight: number;
  bottomTop: number;
  scored: boolean;
}

type GameState = 'Start' | 'Ready' | 'Play' | 'End';

export const useFlappyGame = () => {
  const [gameState, setGameState] = useState<GameState>('Start');
  const [score, setScore] = useState(0);
  const [birdTop, setBirdTop] = useState(40);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [highScore, setHighScore] = useState(0);
  
  const birdVelocity = useRef(0);
  const frameCount = useRef(0);
  const gameLoop = useRef<number>();
  const pipeIdCounter = useRef(0);

  // Exact values from your original JavaScript
  const GRAVITY = 0.5;
  const JUMP_FORCE = -7.6;
  const MOVE_SPEED = 3;
  const PIPE_GAP = 35;

  useEffect(() => {
    const saved = sessionStorage.getItem("flappy_highscore");
    if (saved) {
      setHighScore(parseInt(saved));
    }
  }, []);

  useEffect(() => {
    const paid = sessionStorage.getItem("flappy_paid") === "true";
    let plays = parseInt(sessionStorage.getItem("flappy_plays") || "0");

    if (!paid || plays <= 0) {
      alert("You must pay to play!");
      sessionStorage.removeItem("flappy_paid");
      sessionStorage.removeItem("flappy_plays");
      window.location.href = "/";
      return;
    }

    plays -= 1;
    sessionStorage.setItem("flappy_plays", plays.toString());

    if (plays === 0) {
      setTimeout(() => {
        alert("You've used your last play. Redirecting to homepage...");
        sessionStorage.removeItem("flappy_paid");
        sessionStorage.removeItem("flappy_plays");
        window.location.href = "/";
      }, 8000);
    }
  }, []);

  const deductPlay = useCallback(() => {
    let plays = parseInt(sessionStorage.getItem("flappy_plays") || "0");
    plays = Math.max(plays - 1, 0);
    sessionStorage.setItem("flappy_plays", plays.toString());
    
    if (plays <= 0) {
      sessionStorage.removeItem("flappy_paid");
      alert("No plays left. Please pay to continue.");
      window.location.href = "/";
    }
  }, []);

  const jump = useCallback(() => {
    if (gameState === 'Play') {
      birdVelocity.current = JUMP_FORCE;
    }
  }, [gameState]);

  const startGame = useCallback(() => {
    setGameState('Ready');
    setScore(0);
    setBirdTop(40);
    setPipes([]);
    birdVelocity.current = 0;
    frameCount.current = 0;
    pipeIdCounter.current = 0;
  }, []);

  const beginGameplay = useCallback(() => {
    setGameState('Play');
  }, []);

  const endGame = useCallback(() => {
    setGameState('End');
    
    if (score > 0) {
      saveScore(score);
    }
    
    if (score > highScore) {
      setHighScore(score);
      sessionStorage.setItem("flappy_highscore", score.toString());
    }

    deductPlay();
  }, [score, highScore, deductPlay]);

  const resetGame = useCallback(() => {
    startGame();
  }, [startGame]);

  // Simple game loop matching your original JavaScript exactly
  useEffect(() => {
    if (gameState !== 'Play') return;

    const runGameLoop = () => {
      // Exact gravity logic from your original
      birdVelocity.current += GRAVITY;
      setBirdTop(prev => {
        const newTop = prev + birdVelocity.current;
        
        // Boundary check (your original used pixel heights, converted to vh)
        if (newTop <= 0 || newTop >= 85) {
          endGame();
          return prev;
        }
        
        return newTop;
      });

      // Pipe generation - exact timing from your original
      if (frameCount.current % 115 === 0) {
        const pipePos = Math.floor(Math.random() * 43) + 8;
        const newPipe: Pipe = {
          id: pipeIdCounter.current++,
          left: 100,
          topHeight: pipePos - 70,
          bottomTop: pipePos + PIPE_GAP,
          scored: false
        };
        
        setPipes(prev => [...prev, newPipe]);
      }

      // Pipe movement and collision - exact logic from your original
      setPipes(prev => {
        return prev
          .map(pipe => ({ ...pipe, left: pipe.left - MOVE_SPEED }))
          .filter(pipe => {
            if (pipe.left < -10) {
              return false;
            }
            
            // Collision detection matching your original getBoundingClientRect logic
            const birdLeft = 30;
            const birdRight = 35; 
            const birdTopPos = birdTop;
            const birdBottom = birdTop + 8;
            
            const pipeLeft = pipe.left;
            const pipeRight = pipe.left + 6;
            
            if (birdLeft < pipeRight && birdRight > pipeLeft && 
                birdTopPos < pipe.topHeight + 70 && birdBottom > pipe.topHeight + 70) {
              endGame();
              return false;
            }
            
            if (birdLeft < pipeRight && birdRight > pipeLeft && 
                birdTopPos < pipe.bottomTop && birdBottom > pipe.bottomTop) {
              endGame();
              return false;
            }
            
            // Scoring - when pipe passes bird
            if (!pipe.scored && pipe.left + 6 < birdLeft) {
              pipe.scored = true;
              setScore(prev => prev + 1);
            }
            
            return true;
          });
      });

      frameCount.current++;
      gameLoop.current = requestAnimationFrame(runGameLoop);
    };

    gameLoop.current = requestAnimationFrame(runGameLoop);

    return () => {
      if (gameLoop.current) {
        cancelAnimationFrame(gameLoop.current);
      }
    };
  }, [gameState, birdTop, endGame]);

  // Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (gameState === 'Start' || gameState === 'End') {
          startGame();
        }
      }
      
      if ((e.key === 'ArrowUp' || e.key === ' ')) {
        e.preventDefault();
        if (gameState === 'Ready') {
          beginGameplay();
          jump();
        } else if (gameState === 'Play') {
          jump();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, jump, startGame, beginGameplay]);

  useEffect(() => {
    const handleTouch = () => {
      if (gameState === 'Start') {
        startGame();
      } else if (gameState === 'Ready') {
        beginGameplay();
        jump();
      } else if (gameState === 'Play') {
        jump();
      }
    };

    window.addEventListener('touchstart', handleTouch);
    return () => window.removeEventListener('touchstart', handleTouch);
  }, [gameState, jump, startGame, beginGameplay]);

  return {
    gameState,
    score,
    highScore,
    birdTop,
    pipes,
    startGame,
    beginGameplay,
    jump
  };
};
