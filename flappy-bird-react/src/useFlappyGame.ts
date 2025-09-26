import { useState, useEffect, useRef, useCallback } from 'react';
import { saveScore } from './firebase';

type GameState = 'Start' | 'Ready' | 'Play' | 'End';

export const useFlappyGame = () => {
  const [gameState, setGameState] = useState<GameState>('Start');
  const [score, setScore] = useState(0);
  const [birdTop, setBirdTop] = useState(40); // Track bird position in state
  const [highScore, setHighScore] = useState(0);
  
  const birdRef = useRef<HTMLImageElement>(null);
  const gameLoopRef = useRef<number>();
  const birdDy = useRef(0);
  const pipes = useRef<HTMLDivElement[]>([]);
  const frameCount = useRef(0);
  const backgroundRect = useRef<DOMRect>();

  // Simple game constants
  const moveSpeed = 1.5;     // Slower pipe movement
  const gravity = 0.2;       // Light gravity so bird falls gently
  const pipeGap = 35;
  const jumpForce = -3;      // Small jump force

  useEffect(() => {
    const saved = sessionStorage.getItem("flappy_highscore");
    if (saved) {
      setHighScore(parseInt(saved));
    }
  }, []);

  // Get background dimensions like your original
  useEffect(() => {
    const background = document.querySelector('.background') as HTMLElement;
    if (background) {
      backgroundRect.current = background.getBoundingClientRect();
    }
  }, []);

  const jump = useCallback(() => {
    if (gameState === 'Play') {
      birdDy.current = jumpForce; // Set upward velocity
    }
  }, [gameState]);

  const endGame = useCallback(() => {
    setGameState('End');
    
    if (birdRef.current) {
      birdRef.current.style.display = 'none';
    }

    // Save score
    if (score > 0) {
      saveScore(score);
    }
    
    if (score > highScore) {
      setHighScore(score);
      sessionStorage.setItem("flappy_highscore", score.toString());
    }

    // Stop game loop
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
  }, [score, highScore]);

  const resetGame = useCallback(() => {
    // Clean up existing pipes like your original
    document.querySelectorAll('.pipe_sprite').forEach(e => e.remove());
    pipes.current = [];
    
    if (birdRef.current) {
      birdRef.current.style.display = 'block';
      birdRef.current.style.top = '40vh';
    }
    
    birdDy.current = 0;
    setScore(0);
    setBirdTop(40); // Reset bird position in state too
    frameCount.current = 0;
    setGameState('Ready');
  }, []);

  const startGameLoop = useCallback(() => {
    setGameState('Play');
    
    const gameLoop = () => {
      if (gameState !== 'Play') return;

      const bird = birdRef.current;
      if (!bird || !backgroundRect.current) return;

      // Light gravity - bird falls gently
      birdDy.current += gravity;
      const newTopPixels = bird.offsetTop + birdDy.current;
      
      // Boundary check
      if (newTopPixels <= 0 || newTopPixels + bird.clientHeight >= backgroundRect.current.height) {
        endGame();
        return;
      }
      
      // Update DOM element
      bird.style.top = newTopPixels + 'px';
      
      // Update React state for rendering (convert pixels to vh)
      const newTopVh = (newTopPixels / window.innerHeight) * 100;
      setBirdTop(newTopVh);
      
      const birdProps = bird.getBoundingClientRect();

      // Pipe generation - every 0.5 seconds (30 frames at 60fps)
      if (frameCount.current % 30 === 0) {
        const pipePos = Math.floor(Math.random() * 43) + 8;

        // Top pipe
        const pipeTop = document.createElement('div');
        pipeTop.className = 'pipe_sprite';
        pipeTop.style.top = (pipePos - 70) + 'vh';
        pipeTop.style.left = '100vw';

        // Bottom pipe  
        const pipeBottom = document.createElement('div');
        pipeBottom.className = 'pipe_sprite';
        pipeBottom.style.top = (pipePos + pipeGap) + 'vh';
        pipeBottom.style.left = '100vw';
        (pipeBottom as any).increase_score = true;

        document.body.appendChild(pipeTop);
        document.body.appendChild(pipeBottom);
        pipes.current.push(pipeTop, pipeBottom);
      }

      // Pipe movement and collision - exact logic from your original
      pipes.current = pipes.current.filter(pipe => {
        const pipeRect = pipe.getBoundingClientRect();

        if (pipeRect.right <= 0) {
          pipe.remove();
          return false;
        }

        pipe.style.left = (pipeRect.left - moveSpeed) + 'px';

        // Scoring logic
        if ((pipe as any).increase_score && pipeRect.right < birdProps.left) {
          setScore(prev => {
            const newScore = prev + 1;
            return newScore;
          });
          (pipe as any).increase_score = false;
        }

        // Exact collision detection from your original
        if (
          birdProps.left < pipeRect.left + pipeRect.width &&
          birdProps.left + birdProps.width > pipeRect.left &&
          birdProps.top < pipeRect.top + pipeRect.height &&
          birdProps.top + birdProps.height > pipeRect.top
        ) {
          endGame();
          return false;
        }
        
        return true;
      });

      frameCount.current++;
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, endGame]);

  // Controls matching your original
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && gameState !== 'Play') {
        resetGame();
      }
      if ((e.key === 'ArrowUp' || e.key === ' ')) {
        if (gameState === 'Ready') {
          startGameLoop();
        }
        if (gameState === 'Play') {
          jump();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [gameState, jump, resetGame, startGameLoop]);

  useEffect(() => {
    const handleTouch = () => {
      if (gameState === 'Start') {
        resetGame();
      } else if (gameState === 'Ready') {
        startGameLoop();
      } else if (gameState === 'Play') {
        jump();
      }
    };

    document.addEventListener('touchstart', handleTouch);
    return () => document.removeEventListener('touchstart', handleTouch);
  }, [gameState, jump, resetGame, startGameLoop]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      pipes.current.forEach(pipe => pipe.remove());
    };
  }, []);

  return {
    gameState,
    score,
    highScore,
    birdTop, // Now properly tracked in state
    pipes: [], // Empty array since we use DOM manipulation
    birdRef,
    startGame: resetGame,
    beginGameplay: startGameLoop,
    jump,
    resetGame
  };
};
