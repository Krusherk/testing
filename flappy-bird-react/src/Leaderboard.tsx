import { useState, useEffect } from 'react';
import { loadLeaderboard, type LeaderboardEntry } from './firebase';

interface LeaderboardProps {
  currentScore: number;
}

export default function Leaderboard({ currentScore }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<'rank' | 'score'>('rank');
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleLeaderboardUpdate = (newScores: LeaderboardEntry[], userEntry: LeaderboardEntry | null) => {
      setScores(newScores);
      setCurrentUserEntry(userEntry);
      setLoading(false);
    };

    loadLeaderboard(handleLeaderboardUpdate);
  }, []);

  if (loading) {
    return (
      <div className="leaderboard">
        <div className="leaderboard-header">
          <h2>LEADERBOARD</h2>
          <p className="subtext">Loading scores...</p>
        </div>
      </div>
    );
  }

  const myWallet = sessionStorage.getItem("flappy_wallet")?.toLowerCase();
  const isInTop10 = scores.some(s => s.wallet?.toLowerCase() === myWallet);

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <h2>LEADERBOARD</h2>
        <p className="subtext">Live Monad Games ID players</p>
        <div className="leaderboard-toggle">
          <button 
            className={`toggle-btn ${activeTab === 'rank' ? 'active' : ''}`}
            onClick={() => setActiveTab('rank')}
          >
            Game Rank
          </button>
          <button 
            className={`toggle-btn ${activeTab === 'score' ? 'active' : ''}`}
            onClick={() => setActiveTab('score')}
          >
            High Score
          </button>
        </div>
      </div>
      
      <ul className="leaderboard-list">
        {/* Show current game score if playing */}
        {currentScore > 0 && (
          <li style={{ color: '#FFD700', borderBottom: '2px solid #FFD700' }}>
            <span className="rank">Current:</span>
            <span className="leaderboard-player">{currentUserEntry?.username || 'You'}</span>
            <span className="leaderboard-score">{currentScore}</span>
          </li>
        )}

        {/* Show personal best if not in top 10 */}
        {currentUserEntry && !isInTop10 && (
          <li style={{ color: '#00ff00' }}>
            <span className="rank">Your Best:</span>
            <span className="leaderboard-player">{currentUserEntry.username}</span>
            <span className="leaderboard-score">{currentUserEntry.score}</span>
          </li>
        )}
        
        {/* Top 10 leaderboard */}
        {scores.map((entry, index) => (
          <li 
            key={entry.wallet}
            className={
              index === 0 ? 'top-1' : 
              index === 1 ? 'top-2' : 
              index === 2 ? 'top-3' : ''
            }
            style={{
              color: entry.wallet?.toLowerCase() === myWallet
                ? '#FFD700' 
                : undefined
            }}
          >
            <span className="rank">#{index + 1}</span>
            <span className="leaderboard-player">{entry.username}</span>
            <span className="leaderboard-score">{entry.score}</span>
          </li>
        ))}

        {scores.length === 0 && (
          <li>
            <span>No scores yet. Be the first!</span>
          </li>
        )}
      </ul>
    </div>
  );
}
