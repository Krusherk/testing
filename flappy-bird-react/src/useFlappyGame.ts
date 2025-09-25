import { useState, useEffect, useRef, useCallback } from 'react';
import { saveScore } from './firebase';

type GameState = 'Start' | 'Ready' | 'Play' | 'End';

export const useFlappyGame = () => {
  const [gameState, setGameState] = useState<GameState>('Start');
  const [score, setScore] = useState(0);
  const [birdTop, setBirdTop] = useState(40);
  const [highScore, setHighScore] = useState(0);
  
  const birdRef = useRef<HTMLImageElement>(null);
  const birdDy = useRef(0);
  const frameCount = useRef(0);
  const gameLoop = useRef<number>();
  const pipes = useRef<HTMLDivElement[]>([]);
  
  // Game constants matching your original
  const gravity = 0.5;
  const moveSpeed = 3;
  const pipeGap = 35;

  // Load high score
  useEffect(() => {
    const saved = sessionStorage.getItem("flappy_highscore");
    if (saved) {
      setHighScore(parseInt(saved));
    }
  }, []);

  // Check payment status
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

  const resetGame = useCallback(() => {
    // Clean up existing pipes
    pipes.current.forEach(pipe => pipe.remove());
    pipes.current = [];
    
    // Reset game state
    setGameState('Ready');
    setScore(0);
    setBirdTop(40);
    birdDy.current = 0;
    frameCount.current = 0;
    
    if (birdRef.current) {
      birdRef.current.style.display = 'block';
    }
  }, []);

  const startGameLoop = useCallback(() => {
    setGameState('Play');
    
    const runGameLoop = () => {
      if (gameState !== 'Play') return;

      // Bird physics - exactly like your original
      birdDy.current += gravity;
      
      if (birdRef.current) {
        const currentTop = parseFloat(birdRef.current.style.top || '40vh');
        const newTop = currentTop + birdDy.current;
        
        // Check boundaries
        if (newTop <= 0 || newTop >= 90) {
          endGame();
          return;
        }
        
        birdRef.current.style.top = newTop + 'vh';
        setBirdTop(newTop);
      }

      // Pipe generation - exactly like your original
      if (frameCount.current % 90 === 0) { // Closer pipes than your 115
        const pipePos = Math.floor(Math.random() * 43) + 8;

        // Top pipe
        const pipeTop = document.createElement('div');
        pipeTop.className = 'pipe_sprite';
        pipeTop.style.top = (pipePos - 70) + 'vh';
        pipeTop.style.left = '100vw';
        pipeTop.style.height = '60vh';

        // Bottom pipe  
        const pipeBottom = document.createElement('div');
        pipeBottom.className = 'pipe_sprite';
        pipeBottom.style.top = (pipePos + pipeGap) + 'vh';
        pipeBottom.style.left = '100vw';
        pipeBottom.style.height = '60vh';
        (pipeBottom as any).increase_score = true;

        document.body.appendChild(pipeTop);
        document.body.appendChild(pipeBottom);
        pipes.current.push(pipeTop, pipeBottom);
      }

      // Pipe movement and collision - exactly like your original
      pipes.current = pipes.current.filter(pipe => {
        const pipeRect = pipe.getBoundingClientRect();
        const birdProps = birdRef.current?.getBoundingClientRect();

        if (pipeRect.right <= 0) {
          pipe.remove();
          return false;
        }

        pipe.style.left = (pipeRect.left - moveSpeed) + 'px';

        // Score increase
        if ((pipe as any).increase_score && birdProps && pipeRect.right < birdProps.left) {
          setScore(prev => {
            const newScore = prev + 1;
            return newScore;
          });
          (pipe as any).increase_score = false;
        }

        // Collision detection
        if (birdProps && 
            birdProps.left < pipeRect.left + pipeRect.width &&
            birdProps.left + birdProps.width > pipeRect.left &&
            birdProps.top < pipeRect.top + pipeRect.height &&
            birdProps.top + birdProps.height > pipeRect.top) {
          endGame();
          return false;
        }

        return true;
      });

      frameCount.current++;
      gameLoop.current = requestAnimationFrame(runGameLoop);
    };

    gameLoop.current = requestAnimationFrame(runGameLoop);
  }, [gameState]);

  const endGame = useCallback(() => {
    setGameState('End');
    
    if (birdRef.current) {
      birdRef.current.style.display = 'none';
    }

    // Save score to Firebase
    if (score > 0) {
      saveScore(score);
    }
    
    // Save high score locally
    if (score > highScore) {
      setHighScore(score);
      sessionStorage.setItem("flappy_highscore", score.toString());
    }

    // Clean up game loop
    if (gameLoop.current) {
      cancelAnimationFrame(gameLoop.current);
    }

    deductPlay();
  }, [score, highScore, deductPlay]);

  const jump = useCallback(() => {
    if (gameState === 'Play') {
      birdDy.current = -7.6; // Exact same as your original
    }
  }, [gameState]);

  // Keyboard controls - exactly like your original
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && gameState !== 'Play') {
        resetGame();
      }
      if ((e.key === 'ArrowUp' || e.key === ' ') && gameState === 'Ready') {
        startGameLoop();
        jump();
      }
      if ((e.key === 'ArrowUp' || e.key === ' ') && gameState === 'Play') {
        jump();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [gameState, resetGame, startGameLoop, jump]);

  // Touch controls - exactly like your original
  useEffect(() => {
    const handleTouch = () => {
      if (gameState === 'Start') {
        resetGame();
      } else if (gameState === 'Ready') {
        startGameLoop();
        jump();
      } else if (gameState === 'Play') {
        jump();
      }
    };

    document.addEventListener('touchstart', handleTouch);
    return () => document.removeEventListener('touchstart', handleTouch);
  }, [gameState, resetGame, startGameLoop, jump]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoop.current) {
        cancelAnimationFrame(gameLoop.current);
      }
      pipes.current.forEach(pipe => pipe.remove());
    };
  }, []);

  return {
    gameState,
    score,
    highScore,
    birdTop,
    birdRef,
    resetGame
  };
};