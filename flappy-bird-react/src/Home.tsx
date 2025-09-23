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

  const walletAddress = user?.wallet?.address || '';
  const { user: monadUser, hasUsername, isLoading, error } = useMonadGamesUser(walletAddress);

  const showStatusMessage = (message: string, type: 'success' | 'error' | 'info') => {
    const newMessage = {
      id: messageCounter,
      message,
      type
    };
    
    setStatusMessages(prev => [...prev, newMessage]);
    setMessageCounter(prev => prev + 1);

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
    if (!authenticated || !walletAddress) {
      showStatusMessage('Please connect your wallet first!', 'error');
      return;
    }

    if (!hasUsername || !monadUser) {
      showStatusMessage('Please register a username first!', 'error');
      return;
    }

    sessionStorage.setItem("flappy_discord", monadUser?.username || '');
    sessionStorage.setItem("flappy_wallet", walletAddress);
    sessionStorage.setItem("flappy_paid", "true");
    sessionStorage.setItem("flappy_plays", "999");

    showStatusMessage('Starting game...', 'success');
    
    setTimeout(() => {
      window.history.pushState({}, '', '/game');
      window.location.reload();
    }, 1000);
  };

  // Auto-redirect to registration when wallet connects but no username
  useEffect(() => {
    if (authenticated && walletAddress && !isLoading && !hasUsername && !error) {
      // Automatically open registration page
      window.open('https://monadclip.fun/register', '_blank');
      showStatusMessage('Please complete registration and refresh this page', 'info');
    }
  }, [authenticated, walletAddress, isLoading, hasUsername, error]);

  useEffect(() => {
    if (authenticated && walletAddress) {
      showStatusMessage('Successfully connected to Monad Games ID!', 'success');
    }
  }, [authenticated, walletAddress]);

  useEffect(() => {
    if (walletAddress && !isLoading && hasUsername && monadUser) {
      showStatusMessage(`Welcome back, ${monadUser.username}!`, 'success');
    }
  }, [walletAddress, isLoading, hasUsername, monadUser]);

  useEffect(() => {
    if (error) {
      showStatusMessage(`Error: ${error}`, 'error');
    }
  }, [error]);

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
            <div style={{ color: '#00eaff' }}>Monad Games ID Connected</div>
            <div style={{ fontSize: '10px' }}>{formatWalletAddress(walletAddress)}</div>
          </div>
          
          <div id="usernameStatus">
            {isLoading ? (
              <div style={{ color: '#3498db' }}>Checking username...</div>
            ) : hasUsername && monadUser ? (
              <>
                <div className="username-display">{monadUser.username}</div>
                <div style={{ fontSize: '8px', color: '#ccc' }}>ID: {monadUser.id}</div>
              </>
            ) : (
              <div className="username-prompt">
                <div style={{ color: '#ff6666', marginBottom: '8px' }}>Username Required</div>
                <div style={{ fontSize: '8px', marginBottom: '8px' }}>Registration page should have opened automatically</div>
                <a 
                  href="https://monadclip.fun/register" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="register-link"
                >
                  Register Username
                </a>
                <button 
                  className="btn" 
                  style={{ fontSize: '8px', padding: '6px 12px', marginTop: '8px' }}
                  onClick={() => window.location.reload()}
                >
                  Refresh After Registration
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
        disabled={!authenticated || !hasUsername || !monadUser}
        onClick={handleStartGame}
      >
        START GAME
      </button>

      <footer>
        <span className="pixel-text">Developed by</span>
        <a href="https://x.com/0xqowiyy" target="_blank" rel="noopener noreferrer" className="pixel-text link-text">
          {" "}Crack
        </a>
      </footer>
    </div>
  );
}
