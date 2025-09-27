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

  // Faster, more responsive constants
  const moveSpeed = 0.65;     // Pipe movement speed
  const gravity = 0.6;       // Increased gravity for faster falling
  const pipeGap = 35;        // Gap between pipes
  const jumpForce = -7.8;      // Stronger jump for better response

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
    // Stop game loop immediately
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
    
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
  }, [score, highScore]);

  const resetGame = useCallback(() => {
    // CRITICAL: Stop any existing game loop first
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
    
    // Clean up existing pipes
    document.querySelectorAll('.pipe_sprite').forEach(e => e.remove());
    pipes.current = [];
    
    if (birdRef.current) {
      birdRef.current.style.display = 'block';
      birdRef.current.style.top = '40vh';
    }
    
    // Reset all game state
    birdDy.current = 0;
    setScore(0);
    setBirdTop(40);
    frameCount.current = 0;
    setGameState('Ready');
  }, []);

  const startGameLoop = useCallback(() => {
    // CRITICAL: Stop any existing game loop before starting new one
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
    
    setGameState('Play');
    
    const gameLoop = () => {
      const bird = birdRef.current;
      if (!bird || !backgroundRect.current) {
        gameLoopRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Faster gravity and physics
      birdDy.current += gravity;
      const newTopPixels = bird.offsetTop + birdDy.current;
      
      // Boundary check
      if (newTopPixels <= 0 || newTopPixels + bird.clientHeight >= backgroundRect.current.height) {
        endGame();
        return;
      }
      
      // Update DOM element (fixed positioning)
      bird.style.top = newTopPixels + 'px';
      
      // Update React state for rendering
      const newTopVh = (newTopPixels / window.innerHeight) * 100;
      setBirdTop(newTopVh);
      
      const birdProps = bird.getBoundingClientRect();

      // Pipe generation - with proper spacing
      if (frameCount.current % 45 === 0) {
        const pipePos = Math.floor(Math.random() * 43) + 8;

        // Top pipe - FIXED position
        const pipeTop = document.createElement('div');
        pipeTop.className = 'pipe_sprite';
        pipeTop.style.position = 'fixed';
        pipeTop.style.top = '0vh';
        pipeTop.style.height = (pipePos) + 'vh';
        pipeTop.style.left = '100vw';
        pipeTop.style.width = '6vw';
        pipeTop.style.zIndex = '10';

        // Bottom pipe - FIXED position  
        const pipeBottom = document.createElement('div');
        pipeBottom.className = 'pipe_sprite';
        pipeBottom.style.position = 'fixed';
        pipeBottom.style.top = (pipePos + pipeGap) + 'vh';
        pipeBottom.style.height = (100 - pipePos - pipeGap) + 'vh';
        pipeBottom.style.left = '100vw';
        pipeBottom.style.width = '6vw';
        pipeBottom.style.zIndex = '10';
        (pipeBottom as any).increase_score = true;

        document.body.appendChild(pipeTop);
        document.body.appendChild(pipeBottom);
        pipes.current.push(pipeTop, pipeBottom);
      }

      // Pipe movement - pipes move independently, no collision interference
      pipes.current = pipes.current.filter(pipe => {
        const pipeRect = pipe.getBoundingClientRect();

        if (pipeRect.right <= 0) {
          pipe.remove();
          return false;
        }

        // Move pipe smoothly - no external interference
        const currentLeft = parseFloat(pipe.style.left);
        pipe.style.left = (currentLeft - moveSpeed) + 'vw';

        // Scoring
        if ((pipe as any).increase_score && pipeRect.right < birdProps.left) {
          setScore(prev => prev + 1);
          (pipe as any).increase_score = false;
        }

        // Collision detection - doesn't affect pipe position
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
  }, [endGame]); // Remove gameState from dependency to avoid stale closure

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
