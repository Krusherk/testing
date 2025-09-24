import { useState, useEffect } from "react";

interface MonadGamesUser {
  id: number;
  username: string;
  walletAddress: string;
}

interface UserResponse {
  hasUsername: boolean;
  user?: MonadGamesUser;
}

interface UseMonadGamesUserReturn {
  user: MonadGamesUser | null;
  hasUsername: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useMonadGamesUser(
  walletAddress: string
): UseMonadGamesUserReturn {
  const [user, setUser] = useState<MonadGamesUser | null>(null);
  const [hasUsername, setHasUsername] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setUser(null);
      setHasUsername(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      console.error('Invalid wallet address format:', walletAddress);
      setError('Invalid wallet address format');
      setHasUsername(false);
      setUser(null);
      setIsLoading(false);
      return;
    }

    const fetchUserData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Fetching username for wallet:', walletAddress);
        
        // Try without www first (since your manual test worked)
        let response;
        let data;
        
        try {
          response = await fetch(`https://monadclip.fun/api/check-wallet?wallet=${walletAddress}`);
          if (response.ok) {
            data = await response.json();
            console.log('API response (no www):', data);
          } else {
            throw new Error(`API failed with status ${response.status}`);
          }
        } catch (directError) {
          console.log('Trying with www...', directError.message);
          // Fallback to www version
          response = await fetch(`https://www.monadclip.fun/api/check-wallet?wallet=${walletAddress}`);
          if (!response.ok) {
            throw new Error(`API failed with status ${response.status}`);
          }
          data = await response.json();
          console.log('API response (with www):', data);
        }

        console.log('Raw API response:', data);
        console.log('Response hasUsername:', data.hasUsername);
        console.log('Response user:', data.user);

        if (data.hasUsername && data.user?.username) {
          console.log('Username found:', data.user.username);
          setHasUsername(true);
          setUser(data.user);
        } else {
          console.log('No username found for this wallet');
          setHasUsername(false);
          setUser(null);
        }

      } catch (err) {
        console.error('Error fetching user data:', err);
        setError(err instanceof Error ? err.message : "An error occurred");
        setHasUsername(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [walletAddress]);

  return {
    user,
    hasUsername,
    isLoading,
    error,
  };
}
