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
  const [birdTop, setBirdTop] = useState(40); // vh units
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [highScore, setHighScore] = useState(0);
  
  const birdVelocity = useRef(0);
  const frameCount = useRef(0);
  const gameLoop = useRef<number>();
  const pipeIdCounter = useRef(0);

  // Game constants - Balanced and tested values
  const GRAVITY = 0.3;      // Smooth falling speed
  const JUMP_FORCE = -5.5;  // Good jump height that feels responsive
  const MOVE_SPEED = 2.0;   // Medium pipe speed - not too fast, not too slow
  const PIPE_GAP = 35;      // Comfortable gap for the bird to pass through

  // Load high score on mount
  useEffect(() => {
    const saved = sessionStorage.getItem("flappy_highscore");
    if (saved) {
      setHighScore(parseInt(saved));
    }
  }, []);

  // Check payment status on mount
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
  }, [gameState, JUMP_FORCE]);

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
    
    // Save score to Firebase
    if (score > 0) {
      saveScore(score);
    }
    
    // Save high score locally
    if (score > highScore) {
      setHighScore(score);
      sessionStorage.setItem("flappy_highscore", score.toString());
    }

    deductPlay();
  }, [score, highScore, deductPlay]);

  const resetGame = useCallback(() => {
    startGame();
  }, [startGame]);

  // Main game loop
  useEffect(() => {
    if (gameState !== 'Play') return;

    const runGameLoop = () => {
      // Update bird physics
      birdVelocity.current += GRAVITY;
      setBirdTop(prev => {
        const newTop = prev + birdVelocity.current;
        
        // Check boundaries
        if (newTop <= 0 || newTop >= 90) {
          endGame();
          return prev;
        }
        
        return newTop;
      });

      // Generate pipes - Perfect spacing for medium difficulty
      if (frameCount.current % 70 === 0) {
        const pipeTopHeight = Math.floor(Math.random() * 43) + 8;
        const newPipe: Pipe = {
          id: pipeIdCounter.current++,
          left: 100, // vw units
          topHeight: pipeTopHeight - 70,
          bottomTop: pipeTopHeight + PIPE_GAP,
          scored: false
        };
        
        setPipes(prev => [...prev, newPipe]);
      }

      // Update pipes
      setPipes(prev => {
        return prev
          .map(pipe => ({ ...pipe, left: pipe.left - MOVE_SPEED }))
          .filter(pipe => {
            // Remove pipes that are off-screen
            if (pipe.left < -10) {
              return false;
            }
            
            // Check collision
            const birdLeft = 30; // vw units
            const birdRight = 35; // vw units  
            const birdTopPos = birdTop;
            const birdBottom = birdTop + 10; // bird height in vh
            
            const pipeLeft = pipe.left;
            const pipeRight = pipe.left + 6; // pipe width in vw
            
            if (birdRight > pipeLeft && birdLeft < pipeRight) {
              // Bird is horizontally aligned with pipe
              if (birdTopPos < pipe.topHeight + 70 || birdBottom > pipe.bottomTop) {
                endGame();
                return false;
              }
            }
            
            // Check scoring
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
  }, [gameState, birdTop, endGame, GRAVITY, MOVE_SPEED, PIPE_GAP]);

  // Keyboard controls
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

  // Touch controls
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
