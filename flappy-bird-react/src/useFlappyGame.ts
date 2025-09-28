
import { useState, useEffect, useRef, useCallback } from 'react';

type GameState = 'Start' | 'Ready' | 'Play' | 'End';

export const useFlappyGame = () => {
  const [gameState, setGameState] = useState<GameState>('Start');
  const [score, setScore] = useState(0);
  const [birdTop, setBirdTop] = useState(40);
  const [highScore, setHighScore] = useState(0);
  
  const birdRef = useRef<HTMLImageElement>(null);
  const gameLoopRef = useRef<number>();
  const birdDy = useRef(0);
  const pipes = useRef<HTMLDivElement[]>([]);
  const frameCount = useRef(0);
  const backgroundRect = useRef<DOMRect>();

  // Game constants
  const moveSpeed = 0.65;     // Pipe movement speed
  const gravity = 0.6;       // Gravity for falling
  const pipeGap = 35;        // Gap between pipes
  const jumpForce = -7.9;    // Jump force
  
  useEffect(() => {
    const saved = localStorage.getItem("flappy_highscore");
    if (saved) {
      setHighScore(parseInt(saved));
    }
  }, []);

  useEffect(() => {
    const background = document.querySelector('.background') as HTMLElement;
    if (background) {
      backgroundRect.current = background.getBoundingClientRect();
    }
  }, []);

  // Simplified jump function - mainly for click handler
  const jump = useCallback(() => {
    if (gameState === 'Play') {
      birdDy.current = jumpForce;
    }
  }, [gameState, jumpForce]);

  const endGame = useCallback(() => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
    
    setGameState('End');
    
    if (birdRef.current) {
      birdRef.current.style.display = 'none';
    }

    // Update high score
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem("flappy_highscore", score.toString());
    }
  }, [score, highScore]);

  const resetGame = useCallback(() => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
    
    // Clean up existing pipes
    document.querySelectorAll('.pipe_sprite').forEach(e => e.remove());
    pipes.current = [];
    
    // Reset bird position - set initial position in pixels
    if (birdRef.current) {
      birdRef.current.style.display = 'block';
      birdRef.current.style.position = 'absolute';
      // Set initial position in pixels to match what game loop expects
      const initialTop = window.innerHeight * 0.4; // 40vh in pixels
      birdRef.current.style.top = initialTop + 'px';
    }
    
    // Reset all game state
    birdDy.current = 0;
    setScore(0);
    setBirdTop(40);
    frameCount.current = 0;
    setGameState('Ready');
  }, []);

  const startGameLoop = useCallback(() => {
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

      // Apply gravity
      birdDy.current += gravity;
      const newTopPixels = bird.offsetTop + birdDy.current;
      
      // Boundary check - use proper height comparison
      const gameHeight = backgroundRect.current ? backgroundRect.current.height : window.innerHeight;
      if (newTopPixels <= 0 || newTopPixels + bird.clientHeight >= gameHeight) {
        endGame();
        return;
      }
      
      // Update bird position
      bird.style.position = 'absolute';
      bird.style.top = newTopPixels + 'px';
      
      const birdProps = bird.getBoundingClientRect();

      // Generate pipes
      if (frameCount.current % 45 === 0) {
        const pipePos = Math.floor(Math.random() * 43) + 8;

        // Top pipe
        const pipeTop = document.createElement('div');
        pipeTop.className = 'pipe_sprite';
        pipeTop.style.position = 'fixed';
        pipeTop.style.top = '0vh';
        pipeTop.style.height = (pipePos) + 'vh';
        pipeTop.style.left = '100vw';
        pipeTop.style.width = '6vw';
        pipeTop.style.zIndex = '10';

        // Bottom pipe
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

      // Move pipes and handle collisions
      pipes.current = pipes.current.filter(pipe => {
        const pipeRect = pipe.getBoundingClientRect();

        if (pipeRect.right <= 0) {
          pipe.remove();
          return false;
        }

        // Move pipe
        const currentLeft = parseFloat(pipe.style.left);
        pipe.style.left = (currentLeft - moveSpeed) + 'vw';

        // Score
        if ((pipe as any).increase_score && pipeRect.right < birdProps.left) {
          setScore(prev => prev + 1);
          (pipe as any).increase_score = false;
        }

        // Collision detection
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
  }, [endGame]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault(); // Prevent default browser behavior
      
      if (e.key === 'Enter') {
        // Use a ref to get current game state
        const currentState = gameState;
        if (currentState !== 'Play') {
          resetGame();
        }
      }
      if (e.key === 'ArrowUp' || e.key === ' ') {
        const currentState = gameState;
        if (currentState === 'Ready') {
          startGameLoop();
        } else if (currentState === 'Play') {
          // Directly set jump force instead of relying on callback
          birdDy.current = jumpForce;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [gameState, resetGame, startGameLoop, jumpForce]); // Add jumpForce to dependencies

  // Touch controls
  useEffect(() => {
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault(); // Prevent default touch behavior
      
      const currentState = gameState;
      if (currentState === 'Start') {
        resetGame();
      } else if (currentState === 'Ready') {
        startGameLoop();
      } else if (currentState === 'Play') {
        // Directly set jump force
        birdDy.current = jumpForce;
      }
    };

    document.addEventListener('touchstart', handleTouch, { passive: false });
    return () => document.removeEventListener('touchstart', handleTouch);
  }, [gameState, resetGame, startGameLoop, jumpForce]);

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
    birdTop,
    birdRef,
    startGame: resetGame,
    beginGameplay: startGameLoop,
    jump,
    resetGame
  };
};
