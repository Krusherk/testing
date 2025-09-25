import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, query, orderByChild, limitToLast, onValue, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBJC8jBpf4RJcrjAhgYumUmYzlOxma-ojk",
  authDomain: "flappydak.firebaseapp.com",
  databaseURL: "https://flappydak-default-rtdb.firebaseio.com",
  projectId: "flappydak",
  storageBucket: "flappydak.firebasestorage.app",
  messagingSenderId: "189314171470",
  appId: "1:189314171470:web:4c3a9068fdb909b147791f",
  measurementId: "G-R0LF3F59W9"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export interface LeaderboardEntry {
  username: string;
  wallet: string;
  score: number;
  timestamp: number;
}

// Function to get username from Monad Games API
const getMonadUsername = async (walletAddress: string): Promise<string> => {
  try {
    // Try without www first
    let response;
    try {
      response = await fetch(`https://monadclip.fun/api/check-wallet?wallet=${walletAddress}`);
      if (!response.ok) {
        throw new Error(`API failed with status ${response.status}`);
      }
    } catch (directError) {
      // Fallback to www version
      response = await fetch(`https://www.monadclip.fun/api/check-wallet?wallet=${walletAddress}`);
      if (!response.ok) {
        throw new Error(`API failed with status ${response.status}`);
      }
    }

    const data = await response.json();
    if (data.hasUsername && data.user?.username) {
      return data.user.username;
    }
    
    // Return formatted wallet if no username
    return `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
  } catch (error) {
    console.error('Error fetching username:', error);
    // Return formatted wallet as fallback
    return `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
  }
};

export const saveScore = async (score: number): Promise<void> => {
  const wallet = sessionStorage.getItem("flappy_wallet");
  if (!wallet || score <= 0) return;

  try {
    // Get username from Monad Games API
    const username = await getMonadUsername(wallet);
    
    const scoresRef = ref(db, "scores/" + wallet);
    const snapshot = await get(scoresRef);
    const existing = snapshot.exists() ? snapshot.val().score : 0;
    
    if (score > existing) {
      await set(scoresRef, {
        username: username,
        wallet: wallet,
        score: score,
        timestamp: Date.now()
      });
      console.log('Score saved:', { username, score });
    }
  } catch (error) {
    console.error("Error saving score:", error);
  }
};

export const loadLeaderboard = async (
  onUpdate: (scores: LeaderboardEntry[], currentUserEntry: LeaderboardEntry | null) => void
): Promise<void> => {
  const myWallet = sessionStorage.getItem("flappy_wallet")?.toLowerCase() || "";

  const scoresRef = ref(db, "scores");
  const topScoresQuery = query(scoresRef, orderByChild("score"), limitToLast(10));

  onValue(topScoresQuery, async (snapshot) => {
    const scores: LeaderboardEntry[] = [];
    let currentUserEntry: LeaderboardEntry | null = null;

    snapshot.forEach((child) => {
      const entry = child.val();
      scores.push({
        username: entry.username || 'Anonymous',
        wallet: entry.wallet,
        score: entry.score,
        timestamp: entry.timestamp
      });

      // Check if this is the current user
      if (entry.wallet?.toLowerCase() === myWallet) {
        currentUserEntry = {
          username: entry.username || 'Anonymous',
          wallet: entry.wallet,
          score: entry.score,
          timestamp: entry.timestamp
        };
      }
    });

    scores.reverse(); // highest first
    onUpdate(scores, currentUserEntry);
  });
};