import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useMonadGamesUser } from './useMonadGamesUser';
import './Home.css';

interface StatusMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function Home() {
  const { login, logout, authenticated, user } = usePrivy();
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
  const [messageCounter, setMessageCounter] = useState(0);

  // Get wallet address from user
  const walletAddress = user?.wallet?.address || '';
  
  // Use the custom hook to check for Monad Games username
  const { user: monadUser, hasUsername, isLoading, error } = useMonadGamesUser(walletAddress);

  // Add refresh function for username check
  const refreshUsernameCheck = () => {
    if (walletAddress) {
      showStatusMessage('Rechecking username...', 'info');
      // Force a re-fetch by updating the walletAddress dependency
      window.location.reload();
    }
  };

  const showStatusMessage = (message: string, type: 'success' | 'error' | 'info') => {
    const newMessage = {
      id: messageCounter,
      message,
      type
    };
    
    setStatusMessages(prev => [...prev, newMessage]);
    setMessageCounter(prev => prev + 1);

    // Remove message after 5 seconds
    setTimeout(() => {
      setStatusMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
    }, 5000);
  };

  const formatWalletAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const handleLogin = async () => {
    try {
      showStatusMessage('Connecting to Monad Games ID...', 'info');
      await login();
    } catch (error) {
      console.error('Login failed:', error);
      showStatusMessage('Login failed. Please try again.', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      showStatusMessage('Logged out successfully', 'info');
    } catch (error) {
      console.error('Logout failed:', error);
      showStatusMessage('Logout failed', 'error');
    }
  };

  const handleStartGame = () => {
    console.log('Start game clicked:', { authenticated, hasUsername, monadUser });
    
    if (!authenticated || !walletAddress) {
      showStatusMessage('Please connect your wallet first!', 'error');
      return;
    }

    if (!hasUsername || !monadUser) {
      showStatusMessage('Please register a username first!', 'error');
      return;
    }

    // Store user data for the game (using sessionStorage in React)
    sessionStorage.setItem("flappy_discord", monadUser?.username || '');
    sessionStorage.setItem("flappy_wallet", walletAddress);
    sessionStorage.setItem("flappy_paid", "true");
    sessionStorage.setItem("flappy_plays", "999");

    showStatusMessage('Starting game...', 'success');
    
    setTimeout(() => {
      // Simple navigation - in a real app you'd use React Router
      window.history.pushState({}, '', '/game');
      window.location.reload(); // Trigger re-render
    }, 1000);
  };

  // Show success message when authenticated
  useEffect(() => {
    if (authenticated && walletAddress) {
      showStatusMessage('Successfully connected to Monad Games ID!', 'success');
    }
  }, [authenticated, walletAddress]);

  // Show username status messages
  useEffect(() => {
    if (walletAddress && !isLoading) {
      if (hasUsername && monadUser) {
        showStatusMessage(`Welcome back, ${monadUser.username}!`, 'success');
      } else if (!hasUsername) {
        showStatusMessage('No username found. Please register to play!', 'info');
      }
    }
  }, [walletAddress, isLoading, hasUsername, monadUser]);

  // Show error messages
  useEffect(() => {
    if (error) {
      showStatusMessage(`Failed to check username: ${error}`, 'error');
    }
  }, [error]);

  // Debug log
  useEffect(() => {
    console.log('Current state:', {
      authenticated,
      walletAddress,
      hasUsername,
      monadUser,
      isLoading,
      error
    });
  }, [authenticated, walletAddress, hasUsername, monadUser, isLoading, error]);

  const canStartGame = authenticated && walletAddress && hasUsername && monadUser && !isLoading;

  return (
    <div className="home-container">
      {!authenticated ? (
        <button onClick={handleLogin} className="btn" id="loginBtn">
          Login with Monad Games ID
        </button>
      ) : (
        <button onClick={handleLogout} className="btn" id="logoutBtn">
          Logout
        </button>
      )}

      {authenticated && walletAddress && (
        <div className="user-info-card">
          <div id="walletAddress">
            <div style={{ color: '#00eaff' }}>💎 Monad Games ID Connected</div>
            <div style={{ fontSize: '10px' }}>{formatWalletAddress(walletAddress)}</div>
          </div>
          
          <div id="usernameStatus">
            {isLoading ? (
              <div style={{ color: '#3498db' }}>Checking username...</div>
            ) : hasUsername && monadUser ? (
              <>
                <div className="username-display">👤 {monadUser.username}</div>
                <div style={{ fontSize: '8px', color: '#ccc' }}>ID: {monadUser.id}</div>
              </>
            ) : (
              <div className="username-prompt">
                <div style={{ color: '#ff6666', marginBottom: '8px' }}>⚠ Username Required</div>
                <div style={{ fontSize: '8px', marginBottom: '8px' }}>You need a username to save scores and play</div>
                <a 
                  href="https://monadclip.fun/register" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="register-link"
                  onClick={() => showStatusMessage('Please complete username registration and refresh the page', 'info')}
                >
                  Register Username
                </a>
                <div style={{ fontSize: '8px', color: '#ccc', marginTop: '5px' }}>
                  After registering, click refresh below
                </div>
                <button 
                  className="btn" 
                  style={{ fontSize: '8px', padding: '6px 12px', marginTop: '8px' }}
                  onClick={refreshUsernameCheck}
                  disabled={isLoading}
                >
                  {isLoading ? 'Checking...' : 'Refresh Username'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div id="statusMessages">
        {statusMessages.map((msg) => (
          <div key={msg.id} className={`status-message status-${msg.type}`}>
            {msg.message}
          </div>
        ))}
      </div>

      <button 
        id="startBtn" 
        className="btn start-btn"
        disabled={!canStartGame}
        onClick={handleStartGame}
        style={{
          backgroundColor: canStartGame ? '#7e30e1' : '#444',
          cursor: canStartGame ? 'pointer' : 'not-allowed'
        }}
      >
        START GAME
      </button>

      {/* Debug info - remove in production */}
      <div style={{ 
        position: 'fixed', 
        bottom: '50px', 
        left: '10px', 
        fontSize: '8px', 
        background: 'rgba(0,0,0,0.8)', 
        padding: '5px',
        color: '#fff'
      }}>
        Debug: Auth: {authenticated ? '✓' : '✗'} | 
        Wallet: {walletAddress ? '✓' : '✗'} | 
        Username: {hasUsername ? '✓' : '✗'} | 
        Loading: {isLoading ? '✓' : '✗'}
      </div>

      <footer>
        <span className="pixel-text">Developed by</span>
        <a href="https://x.com/0xqowiyy" target="_blank" rel="noopener noreferrer" className="pixel-text link-text">
          {" "}Crack
        </a>
      </footer>
    </div>
  );
}