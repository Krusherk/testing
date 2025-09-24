import { useState, useEffect, useRef, useCallback } from 'react';

interface Pipe {
  id: number;
  left: number;
  topHeight: number;
  bottomTop: number;
  scored: boolean;
}

type GameState = 'Start' | 'Play' | 'End';

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

  // Game constants
  const GRAVITY = 0.3; // Reduced from 0.5
  const JUMP_FORCE = -6; // Reduced from -7.6
  const MOVE_SPEED = 2; // Reduced from 3
  const PIPE_GAP = 35;

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
      window.location.href = "/"; // Redirect to home
      return;
    }

    // Deduct one play
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
    setGameState('Play');
    setScore(0);
    setBirdTop(40);
    setPipes([]);
    birdVelocity.current = 0;
    frameCount.current = 0;
    pipeIdCounter.current = 0;
  }, []);

  const endGame = useCallback(() => {
    setGameState('End');
    
    // Save high score
    if (score > highScore) {
      setHighScore(score);
      sessionStorage.setItem("flappy_highscore", score.toString());
    }

    // Play sound effect (optional)
    // new Audio('/sounds/die.mp3').play().catch(() => {});

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
        if (newTop <= 0 || newTop >= 90) { // 90vh to account for bird height
          endGame();
          return prev;
        }
        
        return newTop;
      });

      // Generate pipes more frequently
      if (frameCount.current % 90 === 0) { // Changed from 115 to 90
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
              setScore(prev => {
                const newScore = prev + 1;
                // Play point sound
                // new Audio('/sounds/point.mp3').play().catch(() => {});
                return newScore;
              });
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

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (gameState === 'Start' || gameState === 'End') {
          resetGame();
        }
      }
      
      if ((e.key === 'ArrowUp' || e.key === ' ') && gameState === 'Play') {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, jump, resetGame]);

  // Touch controls
  useEffect(() => {
    const handleTouch = () => {
      if (gameState === 'Start') {
        resetGame();
      } else if (gameState === 'Play') {
        jump();
      }
    };

    window.addEventListener('touchstart', handleTouch);
    return () => window.removeEventListener('touchstart', handleTouch);
  }, [gameState, jump, resetGame]);

  return {
    gameState,
    score,
    highScore,
    birdTop,
    pipes,
    startGame: resetGame,
    jump
  };
};
