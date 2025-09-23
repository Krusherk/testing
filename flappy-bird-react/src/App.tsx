import { useState } from 'react'
import Home from './Home'
import Game from './Game'
import './App.css'

function App() {
  // Simple routing state - in a real app you'd use React Router
  const [currentPage, setCurrentPage] = useState<'home' | 'game'>('home');

  // Check URL path for direct navigation
  const path = window.location.pathname;
  if (path === '/game' && currentPage === 'home') {
    setCurrentPage('game');
  }

  if (currentPage === 'game') {
    return <Game />;
  }

  return <Home />;
}

export default App