import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserProvider, Contract } from 'ethers';

type GameState = 'Start' | 'Ready' | 'Play' | 'End';

// Contract ABI for FlappyBirdScore
const FLAPPY_SCORE_ABI = [
  "function submitScore(uint256 score) external",
  "function getHighScore(address player) external view returns (uint256)",
  "function getGamesPlayed(address player) external view returns (uint256)",
  "function getLeaderboard() external view returns (address[] memory players, uint256[] memory scores)",
  "event ScoreSubmitted(address indexed player, uint256 score, uint256 timestamp)",
  "event HighScoreUpdated(address indexed player, uint256 newHighScore)"
];

// Your deployed contract address on Monad Testnet
const FLAPPY_SCORE_CONTRACT = "0x8Fcbf421331122e6FDC98bAB9C254fC6f683968d";
const MONAD_TESTNET_CHAIN_ID = 10143;

export const useFlappyGame = (walletAddress?: string) => {
  const [gameState, setGameState] = useState<GameState>('Start');
  const [score, setScore] = useState(0);
  const [birdTop, setBirdTop] = useState(40);
  const [highScore, setHighScore] = useState(0);
  const [blockchainHighScore, setBlockchainHighScore] = useState(0);
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const birdRef = useRef<HTMLImageElement>(null);
  const gameLoopRef = useRef<number>();
  const birdDy = useRef(0);
  const pipes = useRef<HTMLDivElement[]>([]);
  const frameCount = useRef(0);
  const backgroundRect = useRef<DOMRect>();
  const providerRef = useRef<BrowserProvider | null>(null);
  const contractRef = useRef<Contract | null>(null);

  // Game constants
  const moveSpeed = 0.65;
  const gravity = 0.6;
  const pipeGap = 35;
  const jumpForce = -7.9;
  
  // Initialize blockchain connection
  useEffect(() => {
    const initBlockchain = async () => {
      if (typeof window.ethereum !== 'undefined' && walletAddress) {
        try {
          const provider = new BrowserProvider(window.ethereum);
          providerRef.current = provider;
          
          const contract = new Contract(
            FLAPPY_SCORE_CONTRACT,
            FLAPPY_SCORE_ABI,
            await provider.getSigner()
          );
          contractRef.current = contract;
          
          // Fetch blockchain high score
          const onChainHighScore = await contract.getHighScore(walletAddress);
          setBlockchainHighScore(Number(onChainHighScore));
          
          // Use blockchain high score if higher than local
          if (Number(onChainHighScore) > highScore) {
            setHighScore(Number(onChainHighScore));
          }
        } catch (error) {
          console.error('Failed to initialize blockchain:', error);
        }
      }
    };
    
    initBlockchain();
  }, [walletAddress]);

  // Load local high score on mount
  useEffect(() => {
    const localHighScoreKey = walletAddress 
      ? `flappy_highscore_${walletAddress}`
      : 'flappy_highscore';
    
    const saved = sessionStorage.getItem(localHighScoreKey);
    if (saved) {
      const localScore = parseInt(saved);
      if (localScore > highScore) {
        setHighScore(localScore);
      }
    }
  }, [walletAddress]);

  useEffect(() => {
    const background = document.querySelector('.background') as HTMLElement;
    if (background) {
      backgroundRect.current = background.getBoundingClientRect();
    }
  }, []);

  // Submit score to blockchain
  const submitScoreToBlockchain = useCallback(async (finalScore: number) => {
    if (!contractRef.current || !walletAddress || finalScore === 0) {
      return;
    }

    setIsSubmittingScore(true);
    setSubmitError(null);

    try {
      // Check if we're on the correct network
      const network = await providerRef.current?.getNetwork();
      if (network && Number(network.chainId) !== MONAD_TESTNET_CHAIN_ID) {
        throw new Error('Please switch to Monad Testnet');
      }

      // Submit score transaction
      const tx = await contractRef.current.submitScore(finalScore);
      await tx.wait();
      
      console.log('Score submitted to blockchain:', finalScore);
      
      // Fetch updated blockchain high score
      const newHighScore = await contractRef.current.getHighScore(walletAddress);
      setBlockchainHighScore(Number(newHighScore));
      
    } catch (error: any) {
      console.error('Failed to submit score to blockchain:', error);
      setSubmitError(error.message || 'Failed to submit score');
    } finally {
      setIsSubmittingScore(false);
    }
  }, [walletAddress]);

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

    // Update local high score
    const localHighScoreKey = walletAddress 
      ? `flappy_highscore_${walletAddress}`
      : 'flappy_highscore';
    
    if (score > highScore) {
      setHighScore(score);
      sessionStorage.setItem(localHighScoreKey, score.toString());
    }

    // Submit score to blockchain
    if (walletAddress && score > 0) {
      submitScoreToBlockchain(score);
    }
  }, [score, highScore, walletAddress, submitScoreToBlockchain]);

  const resetGame = useCallback(() => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
    
    document.querySelectorAll('.pipe_sprite').forEach(e => e.remove());
    pipes.current = [];
    
    if (birdRef.current) {
      birdRef.current.style.display = 'block';
      birdRef.current.style.position = 'absolute';
      const initialTop = window.innerHeight * 0.4;
      birdRef.current.style.top = initialTop + 'px';
    }
    
    birdDy.current = 0;
    setScore(0);
    setBirdTop(40);
    frameCount.current = 0;
    setGameState('Ready');
    setSubmitError(null);
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

      birdDy.current += gravity;
      const newTopPixels = bird.offsetTop + birdDy.current;
      
      const gameHeight = backgroundRect.current ? backgroundRect.current.height : window.innerHeight;
      if (newTopPixels <= 0 || newTopPixels + bird.clientHeight >= gameHeight) {
        endGame();
        return;
      }
      
      bird.style.position = 'absolute';
      bird.style.top = newTopPixels + 'px';
      
      const birdProps = bird.getBoundingClientRect();

      if (frameCount.current % 45 === 0) {
        const pipePos = Math.floor(Math.random() * 43) + 8;

        const pipeTop = document.createElement('div');
        pipeTop.className = 'pipe_sprite';
        pipeTop.style.position = 'fixed';
        pipeTop.style.top = '0vh';
        pipeTop.style.height = (pipePos) + 'vh';
        pipeTop.style.left = '100vw';
        pipeTop.style.width = '6vw';
        pipeTop.style.zIndex = '10';

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

      pipes.current = pipes.current.filter(pipe => {
        const pipeRect = pipe.getBoundingClientRect();

        if (pipeRect.right <= 0) {
          pipe.remove();
          return false;
        }

        const currentLeft = parseFloat(pipe.style.left);
        pipe.style.left = (currentLeft - moveSpeed) + 'vw';

        if ((pipe as any).increase_score && pipeRect.right < birdProps.left) {
          setScore(prev => prev + 1);
          (pipe as any).increase_score = false;
        }

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
      e.preventDefault();
      
      if (e.key === 'Enter') {
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
          birdDy.current = jumpForce;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [gameState, resetGame, startGameLoop, jumpForce]);

  // Touch controls
  useEffect(() => {
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      
      const currentState = gameState;
      if (currentState === 'Start') {
        resetGame();
      } else if (currentState === 'Ready') {
        startGameLoop();
      } else if (currentState === 'Play') {
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
    blockchainHighScore,
    birdTop,
    birdRef,
    startGame: resetGame,
    beginGameplay: startGameLoop,
    jump,
    resetGame,
    isSubmittingScore,
    submitError
  };
};
