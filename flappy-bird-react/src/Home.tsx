
import { useState, useEffect } from 'react';
import { usePrivy, CrossAppAccountWithMetadata } from '@privy-io/react-auth';
import { useMonadGamesUser } from './useMonadGamesUser';
import './Home.css';

interface StatusMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function Home() {
  const { login, logout, authenticated, user, ready } = usePrivy();
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
  const [messageCounter, setMessageCounter] = useState(0);
  const [accountAddress, setAccountAddress] = useState<string>('');

  console.log('Home component rendering...', { authenticated, user, ready });

  // Extract wallet address using the proper method from the guide
  useEffect(() => {
    if (authenticated && user && ready) {
      console.log('User linked accounts:', user.linkedAccounts);
      if (user.linkedAccounts && user.linkedAccounts.length > 0) {
        // Get the cross app account created using Monad Games ID    
        const crossAppAccount = user.linkedAccounts.find(
          account => account.type === "cross_app" && 
          account.providerApp && 
          account.providerApp.id === "cmd8euall0037le0my79qpz42"
        ) as CrossAppAccountWithMetadata;

        console.log('Cross app account found:', crossAppAccount);

        // The first embedded wallet created using Monad Games ID, is the wallet address
        if (crossAppAccount && crossAppAccount.embeddedWallets && crossAppAccount.embeddedWallets.length > 0) {
          setAccountAddress(crossAppAccount.embeddedWallets[0].address);
          console.log('Account address set:', crossAppAccount.embeddedWallets[0].address);
        }
      }
    }
  }, [authenticated, user, ready]);

  const { user: monadUser, hasUsername, isLoading, error } = useMonadGamesUser(accountAddress);

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
      setAccountAddress('');
      showStatusMessage('Logged out successfully', 'info');
    } catch (error) {
      console.error('Logout failed:', error);
      showStatusMessage('Logout failed', 'error');
    }
  };

  const handleRegisterUsername = () => {
    console.log('Register username clicked');
    window.open('https://monadclip.fun/', '_blank');
    showStatusMessage('Please complete registration and refresh this page', 'info');
  };

  const handleStartGame = () => {
    if (!authenticated || !accountAddress) {
      showStatusMessage('Please connect your wallet first!', 'error');
      return;
    }

    if (!hasUsername || !monadUser) {
      showStatusMessage('Please register a username first!', 'error');
      return;
    }

    sessionStorage.setItem("flappy_discord", monadUser?.username || '');
    sessionStorage.setItem("flappy_wallet", accountAddress);
    sessionStorage.setItem("flappy_paid", "true");
    sessionStorage.setItem("flappy_plays", "999");

    showStatusMessage('Starting game...', 'success');
    
    setTimeout(() => {
      window.history.pushState({}, '', '/game');
      window.location.reload();
    }, 1000);
  };

  useEffect(() => {
    if (authenticated && accountAddress) {
      showStatusMessage('Successfully connected to Monad Games ID!', 'success');
    }
  }, [authenticated, accountAddress]);

  useEffect(() => {
    if (accountAddress && !isLoading && hasUsername && monadUser) {
      showStatusMessage(`Welcome back, ${monadUser.username}!`, 'success');
    }
  }, [accountAddress, isLoading, hasUsername, monadUser]);

  useEffect(() => {
    if (error) {
      showStatusMessage(`Error: ${error}`, 'error');
    }
  }, [error]);

  console.log('About to render JSX');

  return (
    <div className="home-container">
      <h1 style={{ color: 'white' }}>Flappy Dak</h1>
      
      {!authenticated ? (
        <button onClick={handleLogin} className="btn" id="loginBtn">
          Login with Monad Games ID
        </button>
      ) : (
        <button onClick={handleLogout} className="btn" id="logoutBtn">
          Logout
        </button>
      )}

      <button 
        onClick={handleRegisterUsername} 
        className="btn"
        style={{ backgroundColor: '#e74c3c', marginTop: '10px' }}
        id="registerBtn"
      >
        Register Username
      </button>

      {authenticated && accountAddress && (
        <div className="user-info-card">
          <div id="walletAddress">
            <div style={{ color: '#00eaff' }}>Monad Games ID Connected</div>
            <div style={{ fontSize: '10px' }}>{formatWalletAddress(accountAddress)}</div>
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
              <div style={{ color: '#ff6666', fontSize: '10px' }}>
                No username found. Use the Register Username button above.
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
