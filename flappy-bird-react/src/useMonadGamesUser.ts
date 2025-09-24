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

    const fetchUserData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log('Fetching username for wallet:', walletAddress);
        const response = await fetch(
          `https://monadclip.fun/api/check-wallet?wallet=${walletAddress}`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: UserResponse = await response.json();
        console.log('API response:', data);
        
        setHasUsername(data.hasUsername);
        setUser(data.user || null);
        
        console.log('Updated state:', { 
          hasUsername: data.hasUsername, 
          user: data.user 
        });
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