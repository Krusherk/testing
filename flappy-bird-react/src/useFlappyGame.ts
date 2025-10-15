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

// Deployed contract on Monad Testnet (Updated with correct MonadClip interface)
const FLAPPY_SCORE_CONTRACT = "0x0C526A49E530177554A2de360aD0FEADe0cd6Db2";
const MONAD_TESTNET_CHAIN_ID = 10143;
const MONAD_RPC_URL = "https://testnet-rpc.monad.xyz";

export const useFlappyGame = () => {
  const { authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [privyWalletReady, setPrivyWalletReady] = useState(false);
  
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
          
          // Mark that we should wait for Privy wallet to be ready
          setPrivyWalletReady(false);
        }
      }
    }
  }, [authenticated, user, ready]);

  // Wait for Privy wallets to load
  useEffect(() => {
    if (wallets.length > 0 && walletAddress) {
      const privyWallet = wallets.find(w => 
        w.address.toLowerCase() === walletAddress.toLowerCase()
      );
      if (privyWallet) {
        console.log('✅ Privy wallet is ready:', privyWallet.address);
        setPrivyWalletReady(true);
      }
    }
  }, [wallets, walletAddress]);
  
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
      console.log('🔍 Debug - privyWalletReady:', privyWalletReady);
      console.log('🔍 Debug - wallets count:', wallets.length);
      
      if (!walletAddress) {
        console.log('⚠️ No wallet address available yet');
        return;
      }
      
      if (!authenticated || !user || !ready) {
        console.log('⚠️ User not authenticated or not ready');
        return;
      }

      if (!privyWalletReady || wallets.length === 0) {
        console.log('⚠️ Waiting for Privy wallet to be ready...');
        return;
      }

      try {
        console.log('🔗 Using Privy wallet for blockchain connection...');
        
        // Find the Privy wallet
        const privyWallet = wallets.find(w => 
          w.address.toLowerCase() === walletAddress.toLowerCase()
        );
        
        if (!privyWallet) {
          console.error('❌ Could not find Privy wallet');
          return;
        }

        console.log('✅ Found Privy wallet:', privyWallet.walletClientType);

        // Get provider from Privy wallet (NOT window.ethereum!)
        const privyProvider = await privyWallet.getEthersProvider();
        console.log('✅ Got Privy provider');
        console.log('🔍 Privy provider type:', typeof privyProvider);
        console.log('🔍 Privy provider object:', privyProvider);
        console.log('🔍 Privy provider keys:', Object.keys(privyProvider || {}));
        console.log('🔍 Has request method:', typeof (privyProvider as any)?.request);
        console.log('🔍 Has send method:', typeof (privyProvider as any)?.send);
        console.log('🔍 Has sendAsync method:', typeof (privyProvider as any)?.sendAsync);
        
        // Check if it's actually connected
        if ((privyProvider as any)?.request) {
          try {
            const accounts = await (privyProvider as any).request({ method: 'eth_accounts' });
            console.log('🔍 Provider accounts:', accounts);
          } catch (err) {
            console.log('⚠️ Failed to get accounts:', err);
          }
          
          try {
            const chainId = await (privyProvider as any).request({ method: 'eth_chainId' });
            console.log('🔍 Provider chainId:', chainId, '(decimal:', parseInt(chainId, 16), ')');
          } catch (err) {
            console.log('⚠️ Failed to get chainId:', err);
          }
        }
        
        // Create ethers provider
        const ethersProvider = new ethers.providers.Web3Provider(privyProvider as any);
        providerRef.current = ethersProvider;

        // Get signer from Privy provider
        const signer = ethersProvider.getSigner();
        console.log('✅ Got signer from Privy provider');
        
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

        console.log('✅ Blockchain initialized with Privy. High score:', numericHighScore);
      } catch (error) {
        console.error('❌ Blockchain init error:', error);
        
        // Fallback to RPC for read-only
        console.log('🔗 Falling back to RPC read-only mode...');
        try {
          const rpcProvider = new ethers.providers.JsonRpcProvider(MONAD_RPC_URL);
          const readOnlyContract = new ethers.Contract(
            FLAPPY_SCORE_CONTRACT, 
            FLAPPY_SCORE_ABI, 
            rpcProvider
          );

          const onChainHighScore = await readOnlyContract.getHighScore(walletAddress);
          const numericHighScore = Number(onChainHighScore);
          setBlockchainHighScore(numericHighScore);

          if (numericHighScore > highScore) {
            setHighScore(numericHighScore);
          }

          console.log('✅ Fallback successful. High score:', numericHighScore);
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
        }
      }
    };

    initBlockchain();
  }, [walletAddress, authenticated, user, ready, privyWalletReady, wallets, highScore]);

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

    // Check if we have a Privy wallet for transactions
    if (!privyWalletReady || wallets.length === 0) {
      console.log('⚠️ Privy wallet not ready, cannot submit score');
      setSubmitError('Wallet not ready');
      return;
    }

    setIsSubmittingScore(true);
    setSubmitError(null);

    try {
      // Find the Privy wallet
      const privyWallet = wallets.find(w => 
        w.address.toLowerCase() === walletAddress.toLowerCase()
      );

      if (!privyWallet) {
        throw new Error('Privy wallet not found');
      }

      // Check network using Privy provider
      const network = await providerRef.current.getNetwork();
      const chainId = Number(network.chainId);
      
      console.log('🔗 Current chain ID:', chainId);

      if (chainId !== MONAD_TESTNET_CHAIN_ID) {
        console.log('🔄 Switching to Monad Testnet...');
        
        if (privyWallet.switchChain) {
          await privyWallet.switchChain(MONAD_TESTNET_CHAIN_ID);
          console.log('✅ Network switched');
          
          // Reinitialize provider
          const provider = await privyWallet.getEthersProvider();
          const ethersProvider = new ethers.providers.Web3Provider(provider as any);
          providerRef.current = ethersProvider;
          const signer = ethersProvider.getSigner();
          const contract = new ethers.Contract(
            FLAPPY_SCORE_CONTRACT, 
            FLAPPY_SCORE_ABI, 
            signer
          );
          contractRef.current = contract;
        } else {
          throw new Error('Please switch to Monad Testnet');
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
  }, [walletAddress, privyWalletReady, wallets]);

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
