import { useState, useEffect, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import { usePrivy, useWallets, CrossAppAccountWithMetadata } from "@privy-io/react-auth";

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

export const useFlappyGame = () => {
  const { authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();
  const [walletAddress, setWalletAddress] = useState<string>('');
  
  // Extract wallet address the same way as Home.tsx
  useEffect(() => {
    if (authenticated && user && ready) {
      if (user.linkedAccounts && user.linkedAccounts.length > 0) {
        const crossAppAccount = user.linkedAccounts.find(
          account => account.type === "cross_app" && 
          account.providerApp && 
          account.providerApp.id === "cmd8euall0037le0my79qpz42"
        ) as CrossAppAccountWithMetadata;

        if (crossAppAccount && crossAppAccount.embeddedWallets && crossAppAccount.embeddedWallets.length > 0) {
          const address = crossAppAccount.embeddedWallets[0].address;
          setWalletAddress(address);
          console.log('🎮 Game hook - wallet address set:', address);
        }
      }
    }
  }, [authenticated, user, ready]);
  
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
  const providerRef = useRef<ethers.providers.Web3Provider | null>(null);
  const contractRef = useRef<ethers.Contract | null>(null);

  // Game constants (leave untouched)
  const moveSpeed = 0.65;
  const gravity = 0.6;
  const pipeGap = 35;
  const jumpForce = -7.9;

  // Initialize blockchain provider and contract using Privy
  useEffect(() => {
    const initBlockchain = async () => {
      console.log('🔍 Debug - walletAddress:', walletAddress);
      console.log('🔍 Debug - authenticated:', authenticated);
      console.log('🔍 Debug - ready:', ready);
      console.log('🔍 Debug - wallets count:', wallets.length);
      
      if (!walletAddress) {
        console.log('⚠️ No wallet address available yet');
        return;
      }
      
      if (!authenticated || !user) {
        console.log('⚠️ User not authenticated');
        return;
      }

      // Wait for wallets to load
      if (wallets.length === 0) {
        console.log('⚠️ Wallets not loaded yet, waiting...');
        return;
      }

      try {
        // Find the actual wallet object from useWallets() that matches our address
        const privyWallet = wallets.find(w => 
          w.address.toLowerCase() === walletAddress.toLowerCase()
        );
        
        if (!privyWallet) {
          console.log('⚠️ Could not find matching wallet in wallets array');
          console.log('Looking for:', walletAddress);
          console.log('Available wallets:', wallets.map(w => ({ address: w.address, type: w.walletClientType })));
          return;
        }

        console.log('🔗 Found matching wallet:', {
          address: privyWallet.address,
          walletClientType: privyWallet.walletClientType,
          chainId: privyWallet.chainId
        });

        console.log('🔗 Getting provider from wallet...');

        // Get the EIP-1193 provider from Privy wallet
        const provider = await privyWallet.getEthersProvider();
        
        // Wrap it in ethers v5 Web3Provider
        const ethersProvider = new ethers.providers.Web3Provider(provider);
        providerRef.current = ethersProvider;

        // Get signer
        const signer = ethersProvider.getSigner();
        
        // Create contract instance with signer
        const contract = new ethers.Contract(
          FLAPPY_SCORE_CONTRACT, 
          FLAPPY_SCORE_ABI, 
          signer
        );
        contractRef.current = contract;

        console.log('📝 Contract initialized at:', FLAPPY_SCORE_CONTRACT);

        // Fetch high score from blockchain
        const onChainHighScore = await contract.getHighScore(walletAddress);
        const numericHighScore = Number(onChainHighScore);
        setBlockchainHighScore(numericHighScore);

        if (numericHighScore > highScore) {
          setHighScore(numericHighScore);
        }

        console.log('✅ Blockchain initialized. High score:', numericHighScore);
      } catch (error) {
        console.error('❌ Blockchain init error:', error);
      }
    };

    initBlockchain();
  }, [walletAddress, authenticated, user, ready, wallets, highScore]);

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
  }, [walletAddress, highScore]);

  // Capture background dimensions
  useEffect(() => {
    const bg = document.querySelector('.background') as HTMLElement;
    if (bg) backgroundRect.current = bg.getBoundingClientRect();
  }, []);

  // Submit score to blockchain
  const submitScoreToBlockchain = useCallback(async (finalScore: number) => {
    if (!contractRef.current || !providerRef.current || !walletAddress || finalScore <= 0) {
      console.log('⚠️ Score submission skipped:', {
        hasContract: !!contractRef.current,
        hasProvider: !!providerRef.current,
        hasWallet: !!walletAddress,
        score: finalScore
      });
      return;
    }

    setIsSubmittingScore(true);
    setSubmitError(null);

    try {
      // Check network
      const network = await providerRef.current.getNetwork();
      const chainId = Number(network.chainId);
      
      console.log('🔗 Current chain ID:', chainId);

      if (chainId !== MONAD_TESTNET_CHAIN_ID) {
        // Get the wallet from useWallets for network switching
        const privyWallet = wallets.find(w => 
          w.address.toLowerCase() === walletAddress.toLowerCase()
        );

        if (privyWallet && privyWallet.switchChain) {
          console.log('🔄 Attempting to switch to Monad Testnet...');
          try {
            await privyWallet.switchChain(MONAD_TESTNET_CHAIN_ID);
            console.log('✅ Network switched successfully');
            
            // Reinitialize provider after network switch
            const provider = await privyWallet.getEthersProvider();
            const ethersProvider = new ethers.providers.Web3Provider(provider);
            providerRef.current = ethersProvider;
            const signer = ethersProvider.getSigner();
            const contract = new ethers.Contract(
              FLAPPY_SCORE_CONTRACT, 
              FLAPPY_SCORE_ABI, 
              signer
            );
            contractRef.current = contract;
          } catch (switchError) {
            console.error('❌ Failed to switch network:', switchError);
            throw new Error(`Please switch to Monad Testnet (Chain ID: ${MONAD_TESTNET_CHAIN_ID})`);
          }
        } else {
          throw new Error(`Please switch to Monad Testnet (Chain ID: ${MONAD_TESTNET_CHAIN_ID})`);
        }
      }

      console.log('📤 Submitting score to blockchain:', finalScore);

      // Submit score transaction
      const tx = await contractRef.current.submitScore(finalScore);
      console.log('⏳ Transaction sent:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt.transactionHash);

      // Fetch updated high score
      const updated = await contractRef.current.getHighScore(walletAddress);
      const updatedScore = Number(updated);
      setBlockchainHighScore(updatedScore);
      
      console.log('🏆 Updated blockchain high score:', updatedScore);
    } catch (err: any) {
      console.error('❌ Failed to submit score:', err);
      
      // Better error messages
      let errorMsg = 'Failed to submit score';
      if (err.code === 'ACTION_REJECTED' || err.message?.includes('rejected')) {
        errorMsg = 'Transaction rejected by user';
      } else if (err.message?.includes('insufficient funds')) {
        errorMsg = 'Insufficient funds for gas';
      } else if (err.message?.includes('network')) {
        errorMsg = 'Network error. Please check your connection.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setSubmitError(errorMsg);
    } finally {
      setIsSubmittingScore(false);
    }
  }, [walletAddress, wallets]);

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

    // Submit to blockchain
    if (walletAddress && score > 0) {
      console.log('🎮 Game ended with score:', score);
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
    walletAddress, // Export wallet address
  };
};
