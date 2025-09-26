import { useState, useEffect, useRef, useCallback } from 'react';
import { saveScore } from './firebase';

interface Pipe {
  id: number;
  x: number;
  height: [number, number]; // [bottom pipe height, top pipe height]
}

type GameState = 'Start' | 'Ready' | 'Play' | 'End';

export const useFlappyGame = () => {
  const [gameState, setGameState] = useState<GameState>('Start');
  const [score, setScore] = useState(0);
  const [birdTop, setBirdTop] = useState(40);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [highScore, setHighScore] = useState(0);
  
  const velocity = useRef(0);
  const deltaTop = useRef(0);
  const gameTimer = useRef<number>();
  const pipeIdCounter = useRef(0);
  const scorePipe = useRef<number | null>(null);

  // Game constants matching the example
  const GRAVITY = 15; // velocity multiplier
  const JUMP_DISTANCE = -12; // jump force
  const PIPE_SPEED = 3.5; // pixels per frame
  const PIPE_GAP = 150; // gap between top and bottom pipes
  const PIPE_SPACING = 300; // distance between pipe pairs

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

  // Generate pipe pair heights
  const generatePipePairs = useCallback(() => {
    const minHeight = 50;
    const maxHeight = 250;
    const bottomPipeHeight = Math.floor(Math.random() * (maxHeight - minHeight)) + minHeight;
    const topPipeHeight = 400 - bottomPipeHeight - PIPE_GAP;
    return [bottomPipeHeight, topPipeHeight];
  }, [PIPE_GAP]);

  // Fall physics exactly like the example
  const fall = useCallback(() => {
    const maxBot = 90; // bottom boundary in vh
    let deltaPos = deltaTop.current + (velocity.current * 0.016);
    const newPos = birdTop + deltaPos;
    
    return { 
      newPos: newPos <= maxBot ? newPos : maxBot, 
      newDeltaPos: deltaPos 
    };
  }, [birdTop]);

  // Jump function exactly like the example
  const jump = useCallback(() => {
    if (gameState === 'Play') {
      const minTop = 0;
      const newPos = birdTop + JUMP_DISTANCE;
      setBirdTop(newPos >= minTop ? newPos : minTop);
      deltaTop.current = JUMP_DISTANCE;
    }
  }, [gameState, birdTop, JUMP_DISTANCE]);

  // Update pipes exactly like the example
  const updatePipes = useCallback(() => {
    // Remove out of bound pipes
    const cleaned = pipes.filter(p => p.x >= -50);
    const missing = (4 - cleaned.length);
    let baseDistance = 100; // start position in vw
    const copy = [...cleaned];
    
    for(let i = 0; i < missing; i++) {
      baseDistance += PIPE_SPACING / 10; // convert to vw
      const newPipe: Pipe = {
        x: baseDistance,
        id: pipeIdCounter.current++,
        height: generatePipePairs(),
      };
      copy.push(newPipe);
    }
    
    // Move pipes
    const movePipes = copy.map((p) => ({ ...p, x: p.x - PIPE_SPEED }));
    return movePipes;
  }, [pipes, generatePipePairs, PIPE_SPEED, PIPE_SPACING]);

  // Update game state
  const updateGame = useCallback((winningPipe: number | null) => {
    const newScore = scorePipe.current && scorePipe.current !== winningPipe ? score + 1 : score;
    
    const newFallPosition = fall();
    const newPipes = updatePipes();

    setBirdTop(newFallPosition.newPos);
    setPipes(newPipes);
    deltaTop.current = newFallPosition.newDeltaPos;
    scorePipe.current = winningPipe;
    setScore(newScore);
  }, [score, fall, updatePipes]);

  // Check game state - collision and scoring
  const checkGame = useCallback(() => {
    // Check for collision
    const collisionPipe = pipes.filter(p => p.x >= 20 && p.x <= 40);
    if(collisionPipe.length) {
      const pipe = collisionPipe[0];
      const topLimit = (pipe.height[1] / 400) * 100; // convert to vh
      const botLimit = 100 - (pipe.height[0] / 400) * 100; // convert to vh
      
      if(birdTop <= topLimit || birdTop >= botLimit - 8) { // 8vh for bird height
        return stopGame();
      }
    }

    // Check for scoring
    const winningPipe = pipes.filter(p => p.x >= 15 && p.x <= 25);
    if(winningPipe.length) {
      return updateGame(winningPipe[0].id);
    }

    updateGame(null);
  }, [pipes, birdTop, updateGame]);

  // Start game with timer like the example
  const startGameLoop = useCallback(() => {
    if (gameTimer.current) clearInterval(gameTimer.current);
    gameTimer.current = window.setInterval(() => checkGame(), 16.66); // 60fps
    setGameState('Play');
  }, [checkGame]);

  // Stop game
  const stopGame = useCallback(() => {
    if (gameTimer.current) {
      clearInterval(gameTimer.current);
      gameTimer.current = undefined;
    }
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

  const startGame = useCallback(() => {
    setGameState('Ready');
    setScore(0);
    setBirdTop(40);
    setPipes([]);
    velocity.current = GRAVITY;
    deltaTop.current = 0;
    pipeIdCounter.current = 0;
    scorePipe.current = null;
  }, [GRAVITY]);

  const resetGame = useCallback(() => {
    startGame();
  }, [startGame]);

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
          startGameLoop();
          jump();
        } else if (gameState === 'Play') {
          jump();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, jump, startGame, startGameLoop]);

  useEffect(() => {
    const handleTouch = () => {
      if (gameState === 'Start') {
        startGame();
      } else if (gameState === 'Ready') {
        startGameLoop();
        jump();
      } else if (gameState === 'Play') {
        jump();
      }
    };

    window.addEventListener('touchstart', handleTouch);
    return () => window.removeEventListener('touchstart', handleTouch);
  }, [gameState, jump, startGame, startGameLoop]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (gameTimer.current) {
        clearInterval(gameTimer.current);
      }
    };
  }, []);

  return {
    gameState,
    score,
    highScore,
    birdTop,
    pipes: pipes.map(p => ({
      id: p.id,
      left: p.x,
      topHeight: -70 + (p.height[1] / 400) * 100,
      bottomTop: 100 - (p.height[0] / 400) * 100,
      scored: false
    })),
    startGame,
    jump
  };
};
