import { useState, useEffect, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
const BrowserProvider = ethers.providers.Web3Provider;
const { Contract } = ethers;

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

// Deployed contract on Monad Testnet
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

  // Game constants (leave untouched)
  const moveSpeed = 0.65;
  const gravity = 0.6;
  const pipeGap = 35;
  const jumpForce = -7.9;

  // Initialize blockchain provider and contract
  useEffect(() => {
    const initBlockchain = async () => {
      if (typeof window.ethereum !== 'undefined' && walletAddress) {
        try {
          const provider = new BrowserProvider(window.ethereum);
          providerRef.current = provider;

          const signer = await provider.getSigner();
          const contract = new Contract(FLAPPY_SCORE_CONTRACT, FLAPPY_SCORE_ABI, signer);
          contractRef.current = contract;

          const onChainHighScore = await contract.getHighScore(walletAddress);
          const numericHighScore = Number(onChainHighScore);
          setBlockchainHighScore(numericHighScore);

          if (numericHighScore > highScore) {
            setHighScore(numericHighScore);
          }
        } catch (error) {
          console.error('Blockchain init error:', error);
        }
      }
    };

    initBlockchain();
  }, [walletAddress]);

  // Load local high score from sessionStorage
  useEffect(() => {
    const key = walletAddress ? `flappy_highscore_${walletAddress}` : 'flappy_highscore';
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const localScore = parseInt(saved);
      if (localScore > highScore) {
        setHighScore(localScore);
      }
    }
  }, [walletAddress]);

  // Capture background dimensions
  useEffect(() => {
    const bg = document.querySelector('.background') as HTMLElement;
    if (bg) backgroundRect.current = bg.getBoundingClientRect();
  }, []);

  // Submit score to blockchain
  const submitScoreToBlockchain = useCallback(async (finalScore: number) => {
    if (!contractRef.current || !providerRef.current || !walletAddress || finalScore <= 0) return;

    setIsSubmittingScore(true);
    setSubmitError(null);

    try {
      const network = await providerRef.current.getNetwork();
      if (!network || Number(network.chainId) !== MONAD_TESTNET_CHAIN_ID) {
        throw new Error('Please switch to Monad Testnet');
      }

      const tx = await contractRef.current.submitScore(finalScore);
      await tx.wait();

      console.log('✅ Score submitted to blockchain:', finalScore);

      const updated = await contractRef.current.getHighScore(walletAddress);
      setBlockchainHighScore(Number(updated));
    } catch (err: any) {
      console.error('Failed to submit score:', err);
      setSubmitError(err.message || 'Blockchain error');
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
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = undefined;

    setGameState('End');
    if (birdRef.current) birdRef.current.style.display = 'none';

    const key = walletAddress ? `flappy_highscore_${walletAddress}` : 'flappy_highscore';
    if (score > highScore) {
      setHighScore(score);
      sessionStorage.setItem(key, score.toString());
    }

    if (walletAddress && score > 0) {
      submitScoreToBlockchain(score);
    }
  }, [score, highScore, walletAddress, submitScoreToBlockchain]);

  const resetGame = useCallback(() => {
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = undefined;

    document.querySelectorAll('.pipe_sprite').forEach(e => e.remove());
    pipes.current = [];

    if (birdRef.current) {
      birdRef.current.style.display = 'block';
      birdRef.current.style.position = 'absolute';
      birdRef.current.style.top = window.innerHeight * 0.4 + 'px';
    }

    birdDy.current = 0;
    setScore(0);
    setBirdTop(40);
    frameCount.current = 0;
    setGameState('Ready');
    setSubmitError(null);
  }, []);

  // Core game loop (no tampering)
  const startGameLoop = useCallback(() => {
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    setGameState('Play');

    const gameLoop = () => {
      const bird = birdRef.current;
      if (!bird || !backgroundRect.current) {
        gameLoopRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      birdDy.current += gravity;
      const newTop = bird.offsetTop + birdDy.current;
      const gameHeight = backgroundRect.current.height || window.innerHeight;

      if (newTop <= 0 || newTop + bird.clientHeight >= gameHeight) {
        endGame();
        return;
      }

      bird.style.top = newTop + 'px';
      const birdProps = bird.getBoundingClientRect();

      // Pipes & collisions untouched
      if (frameCount.current % 45 === 0) {
        const pipePos = Math.floor(Math.random() * 43) + 8;

        const pipeTop = document.createElement('div');
        pipeTop.className = 'pipe_sprite';
        pipeTop.style.position = 'fixed';
        pipeTop.style.top = '0vh';
        pipeTop.style.height = `${pipePos}vh`;
        pipeTop.style.left = '100vw';
        pipeTop.style.width = '6vw';
        pipeTop.style.zIndex = '10';

        const pipeBottom = document.createElement('div');
        pipeBottom.className = 'pipe_sprite';
        pipeBottom.style.position = 'fixed';
        pipeBottom.style.top = `${pipePos + pipeGap}vh`;
        pipeBottom.style.height = `${100 - pipePos - pipeGap}vh`;
        pipeBottom.style.left = '100vw';
        pipeBottom.style.width = '6vw';
        pipeBottom.style.zIndex = '10';
        (pipeBottom as any).increase_score = true;

        document.body.appendChild(pipeTop);
        document.body.appendChild(pipeBottom);
        pipes.current.push(pipeTop, pipeBottom);
      }

      pipes.current = pipes.current.filter(pipe => {
        const rect = pipe.getBoundingClientRect();
        if (rect.right <= 0) {
          pipe.remove();
          return false;
        }

        pipe.style.left = `${parseFloat(pipe.style.left) - moveSpeed}vw`;

        if ((pipe as any).increase_score && rect.right < birdProps.left) {
          setScore(prev => prev + 1);
          (pipe as any).increase_score = false;
        }

        if (
          birdProps.left < rect.left + rect.width &&
          birdProps.left + birdProps.width > rect.left &&
          birdProps.top < rect.top + rect.height &&
          birdProps.top + birdProps.height > rect.top
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

  // Controls (untouched)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();

      if (e.key === 'Enter' && gameState !== 'Play') resetGame();
      if (e.key === 'ArrowUp' || e.key === ' ') {
        if (gameState === 'Ready') startGameLoop();
        else if (gameState === 'Play') birdDy.current = jumpForce;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [gameState, resetGame, startGameLoop, jumpForce]);

  useEffect(() => {
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();

      if (gameState === 'Start') resetGame();
      else if (gameState === 'Ready') startGameLoop();
      else if (gameState === 'Play') birdDy.current = jumpForce;
    };

    document.addEventListener('touchstart', handleTouch, { passive: false });
    return () => document.removeEventListener('touchstart', handleTouch);
  }, [gameState, resetGame, startGameLoop, jumpForce]);

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      pipes.current.forEach(p => p.remove());
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
    submitError,
  };
};
