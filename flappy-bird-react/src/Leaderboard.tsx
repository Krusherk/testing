import { useState } from 'react';

interface LeaderboardProps {
  currentScore: number;
}

export default function Leaderboard({ currentScore }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<'rank' | 'score'>('rank');

  // For now, we'll show mock data since Firebase is removed
  // You can implement your own leaderboard logic here
  const mockLeaderboard = [
    { rank: 1, name: "Player1", score: 150 },
    { rank: 2, name: "Player2", score: 142 },
    { rank: 3, name: "Player3", score: 138 },
    { rank: 4, name: "Player4", score: 125 },
    { rank: 5, name: "Player5", score: 119 },
  ];

  const currentUser = sessionStorage.getItem("flappy_discord") || "You";
  const currentWallet = sessionStorage.getItem("flappy_wallet");

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <h2>LEADERBOARD</h2>
        <p className="subtext">Only top players get rewards</p>
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
        {currentScore > 0 && (
          <li style={{ color: '#FFD700' }}>
            <span className="rank">Current:</span>
            <span className="leaderboard-player">{currentUser}</span>
            <span className="leaderboard-score">{currentScore}</span>
          </li>
        )}
        
        {mockLeaderboard.map((entry) => (
          <li 
            key={entry.rank}
            className={
              entry.rank === 1 ? 'top-1' : 
              entry.rank === 2 ? 'top-2' : 
              entry.rank === 3 ? 'top-3' : ''
            }
          >
            <span className="rank">#{entry.rank}</span>
            <span className="leaderboard-player">{entry.name}</span>
            <span className="leaderboard-score">{entry.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}