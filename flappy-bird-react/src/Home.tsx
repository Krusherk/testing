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
      showStatusMessage('Please register a username first using the button above!', 'error');
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

  const canStartGame = authenticated && walletAddress && hasUsername && monadUser && !isLoading;

  return (
    <div className="home-container">
      {/* Step 1: Login */}
      {!authenticated ? (
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: 'white', marginBottom: '20px' }}>Step 1: Connect Wallet</h3>
          <button onClick={handleLogin} className="btn" id="loginBtn">
            Login with Monad Games ID
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#00ff00', marginBottom: '10px' }}>✓ Wallet Connected</h3>
          <button onClick={handleLogout} className="btn" id="logoutBtn">
            Logout
          </button>
        </div>
      )}

      {/* Step 2: Username Registration */}
      {authenticated && walletAddress && (
        <div className="user-info-card">
          <div style={{ color: '#00eaff', marginBottom: '10px' }}>
            💎 {formatWalletAddress(walletAddress)}
          </div>
          
          {isLoading ? (
            <div style={{ color: '#3498db' }}>
              <h4>Step 2: Checking Username...</h4>
              <div>Please wait...</div>
            </div>
          ) : hasUsername && monadUser ? (
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ color: '#00ff00' }}>✓ Username Registered</h4>
              <div className="username-display">👤 {monadUser.username}</div>
              <div style={{ fontSize: '8px', color: '#ccc' }}>ID: {monadUser.id}</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ color: '#ff6666' }}>Step 2: Register Username</h4>
              <div style={{ fontSize: '10px', marginBottom: '15px', color: '#ccc' }}>
                You need a username to play and save scores
              </div>
              
              {/* BIG OBVIOUS REGISTER BUTTON */}
              <a 
                href="https://monadclip.fun/register" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn"
                style={{
                  display: 'inline-block',
                  backgroundColor: '#e74c3c',
                  fontSize: '14px',
                  padding: '15px 25px',
                  marginBottom: '10px',
                  textDecoration: 'none'
                }}
                onClick={() => showStatusMessage('Complete registration and return to refresh', 'info')}
              >
                🚀 REGISTER USERNAME
              </a>
              
              <div style={{ fontSize: '8px', color: '#ccc', marginBottom: '10px' }}>
                ↑ Click above to register, then return and refresh
              </div>
              
              <button 
                className="btn" 
                style={{ fontSize: '10px', padding: '8px 15px' }}
                onClick={refreshUsernameCheck}
                disabled={isLoading}
              >
                {isLoading ? 'Checking...' : '🔄 Refresh Username Check'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status Messages */}
      <div id="statusMessages">
        {statusMessages.map((msg) => (
          <div key={msg.id} className={`status-message status-${msg.type}`}>
            {msg.message}
          </div>
        ))}
      </div>

      {/* Step 3: Start Game */}
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <h3 style={{ color: canStartGame ? '#00ff00' : '#666' }}>
          {canStartGame ? '✓ Ready to Play!' : 'Complete Steps Above'}
        </h3>
        <button 
          id="startBtn" 
          className="btn start-btn"
          disabled={!canStartGame}
          onClick={handleStartGame}
          style={{
            backgroundColor: canStartGame ? '#7e30e1' : '#444',
            cursor: canStartGame ? 'pointer' : 'not-allowed',
            fontSize: '18px',
            padding: '15px 30px'
          }}
        >
          {canStartGame ? '🎮 START GAME' : '❌ START GAME (Disabled)'}
        </button>
      </div>

      {/* Debug Panel */}
      <div style={{ 
        position: 'fixed', 
        bottom: '80px', 
        left: '10px', 
        fontSize: '10px', 
        background: 'rgba(0,0,0,0.9)', 
        padding: '10px',
        color: '#fff',
        borderRadius: '5px',
        fontFamily: 'monospace'
      }}>
        <strong>Debug Info:</strong><br/>
        Authenticated: {authenticated ? '✅ YES' : '❌ NO'}<br/>
        Wallet Address: {walletAddress ? '✅ YES' : '❌ NO'}<br/>
        Has Username: {hasUsername ? '✅ YES' : '❌ NO'}<br/>
        User Object: {monadUser ? '✅ YES' : '❌ NO'}<br/>
        Loading: {isLoading ? '⏳ YES' : '✅ NO'}<br/>
        Error: {error ? '❌ ' + error : '✅ NONE'}
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
