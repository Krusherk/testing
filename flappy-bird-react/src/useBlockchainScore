import { useState, useEffect, useRef, useCallback } from 'react';
import { ethers } from 'ethers';

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

interface UseBlockchainScoreReturn {
  blockchainHighScore: number;
  isSubmittingScore: boolean;
  submitError: string | null;
  submitScore: (score: number) => Promise<void>;
  fetchHighScore: () => Promise<void>;
  isInitialized: boolean;
}

export const useBlockchainScore = (walletAddress?: string): UseBlockchainScoreReturn => {
  const [blockchainHighScore, setBlockchainHighScore] = useState(0);
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const providerRef = useRef<ethers.BrowserProvider | null>(null);
  const contractRef = useRef<ethers.Contract | null>(null);

  // Initialize blockchain connection
  useEffect(() => {
    const initBlockchain = async () => {
      if (typeof window.ethereum !== 'undefined' && walletAddress) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          providerRef.current = provider;
          
          const contract = new ethers.Contract(
            FLAPPY_SCORE_CONTRACT,
            FLAPPY_SCORE_ABI,
            await provider.getSigner()
          );
          contractRef.current = contract;
          
          // Fetch blockchain high score
          const onChainHighScore = await contract.getHighScore(walletAddress);
          setBlockchainHighScore(Number(onChainHighScore));
          setIsInitialized(true);
          
          console.log('Blockchain initialized. High score:', Number(onChainHighScore));
        } catch (error) {
          console.error('Failed to initialize blockchain:', error);
          setIsInitialized(false);
        }
      } else {
        setIsInitialized(false);
      }
    };
    
    initBlockchain();
  }, [walletAddress]);

  // Fetch high score from blockchain
  const fetchHighScore = useCallback(async () => {
    if (!contractRef.current || !walletAddress) {
      return;
    }

    try {
      const onChainHighScore = await contractRef.current.getHighScore(walletAddress);
      setBlockchainHighScore(Number(onChainHighScore));
    } catch (error) {
      console.error('Failed to fetch high score:', error);
    }
  }, [walletAddress]);

  // Submit score to blockchain
  const submitScore = useCallback(async (score: number) => {
    if (!contractRef.current || !walletAddress || score === 0) {
      console.log('Cannot submit score:', { 
        hasContract: !!contractRef.current, 
        hasWallet: !!walletAddress, 
        score 
      });
      return;
    }

    setIsSubmittingScore(true);
    setSubmitError(null);

    try {
      // Check if we're on the correct network
      const network = await providerRef.current?.getNetwork();
      if (network && Number(network.chainId) !== MONAD_TESTNET_CHAIN_ID) {
        throw new Error('Please switch to Monad Testnet (Chain ID: 10143)');
      }

      console.log('Submitting score to blockchain:', score);

      // Submit score transaction
      const tx = await contractRef.current.submitScore(score);
      console.log('Transaction sent:', tx.hash);
      
      await tx.wait();
      console.log('Transaction confirmed!');
      
      // Fetch updated blockchain high score
      await fetchHighScore();
      
    } catch (error: any) {
      console.error('Failed to submit score to blockchain:', error);
      
      // Parse user-friendly error messages
      let errorMessage = 'Failed to submit score';
      if (error.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction rejected by user';
      } else if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setSubmitError(errorMessage);
    } finally {
      setIsSubmittingScore(false);
    }
  }, [walletAddress, fetchHighScore]);

  return {
    blockchainHighScore,
    isSubmittingScore,
    submitError,
    submitScore,
    fetchHighScore,
    isInitialized
  };
};
