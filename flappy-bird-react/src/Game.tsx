
import { useFlappyGame } from './useFlappyGame';
import './Game.css';

export default function Game() {
  const { gameState, score, highScore, birdTop, birdRef, startGame, beginGameplay, jump } = useFlappyGame();
  
  const handleClick = () => {
    if (gameState === 'Start' || gameState === 'End') {
      startGame();
    } else if (gameState === 'Ready') {
      beginGameplay();
    } else if (gameState === 'Play') {
      jump();
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
          position: 'absolute',
          top: `${birdTop}vh`,
          display: gameState === 'End' ? 'none' : 'block'
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
    </div>
  );
}
