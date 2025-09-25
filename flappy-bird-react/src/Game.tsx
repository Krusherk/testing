import { useFlappyGame } from './useFlappyGame';
import Leaderboard from './Leaderboard';
import './Game.css';

export default function Game() {
  const { gameState, score, birdRef, resetGame } = useFlappyGame();

  const handleClick = () => {
    if (gameState === 'Start' || gameState === 'End') {
      resetGame();
    }
  };

  return (
    <div className="game-container" onClick={handleClick}>
      {/* Background */}
      <div className="background"></div>
      
      {/* Bird */}
      <img 
        ref={birdRef}
        src="/images/Bird-2.svg" 
        alt="bird-img" 
        className="bird" 
        style={{
          top: '40vh',
          display: 'block'
        }}
        width="130"
        height="100"
      />

      {/* Game Messages */}
      {gameState === 'Start' && (
        <div className="message messageStyle">
          Press Enter To Start Game
          <p><span style={{ color: 'red' }}>&uarr;</span> ArrowUp to Control</p>
        </div>
      )}

      {gameState === 'Ready' && (
        <div className="message messageStyle">
          Press <span style={{ color: 'red' }}>ArrowUp</span> to Begin!
        </div>
      )}

      {gameState === 'End' && (
        <div className="message messageStyle">
          <span style={{ color: 'red' }}>Game Over</span>
          <br />
          Press Enter To Restart
        </div>
      )}

      {/* Score Display */}
      <div className="score">
        <span className="score_title">SCORE</span>
        <span className="score_val">{score}</span>
      </div>

      {/* Leaderboard */}
      <Leaderboard currentScore={score} />
    </div>
  );
}