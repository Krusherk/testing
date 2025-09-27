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
      response = await fetch(https://monadclip.fun/api/check-wallet?wallet=${walletAddress});
      if (!response.ok) {
        throw new Error(API failed with status ${response.status});
      }
    } catch (directError) {
      // Fallback to www version
      response = await fetch(https://www.monadclip.fun/api/check-wallet?wallet=${walletAddress});
      if (!response.ok) {
        throw new Error(API failed with status ${response.status});
      }
    }

    const data = await response.json();
    if (data.hasUsername && data.user?.username) {
      return data.user.username;
    }
    
    // Return formatted wallet if no username
    return ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)};
  } catch (error) {
    console.error('Error fetching username:', error);
    // Return formatted wallet as fallback
    return ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)};
  }
};

export const saveScore = async (score: number): Promise<void> => {
  console.log('=== SAVE SCORE FUNCTION CALLED ===');
  
  const wallet = sessionStorage.getItem("flappy_wallet");
  const username = sessionStorage.getItem("flappy_discord");
  
  console.log('Retrieved from sessionStorage:');
  console.log('- Wallet:', wallet);
  console.log('- Username:', username);
  console.log('- Score to save:', score);
  
  if (!wallet || score <= 0) {
    console.log('❌ Cannot save - No wallet or score <= 0:', { wallet, score });
    return;
  }

  try {
    console.log('✅ Starting save process...');
    
    // Get username from Monad Games API
    const fetchedUsername = await getMonadUsername(wallet);
    
    // Prefer stored username, otherwise fallback to fetched
    const finalUsername = username || fetchedUsername;
    
    const scoresRef = ref(db, "scores/" + wallet);
    console.log("📌 Writing to Firebase path:", "scores/" + wallet);
    
    const snapshot = await get(scoresRef);
    const existingScore = snapshot.exists() ? snapshot.val().score : 0;
    
    console.log(📊 Existing: ${existingScore}, New: ${score});
    
    // Always save if higher OR if no score exists
    if (!snapshot.exists() || score > existingScore) {
      const dataToSave = {
        username: finalUsername,
        wallet,
        score,
        timestamp: Date.now()
      };
      
      await set(scoresRef, dataToSave);
      console.log('✅ Score saved successfully:', dataToSave);
    } else {
      console.log('⚠️ New score is not higher, skipping save.');
    }
  } catch (error) {
    console.error('❌ Error saving score to Firebase:', error);
  }
  
  console.log('=== SAVE SCORE FUNCTION ENDED ===');
};

export const loadLeaderboard = async (
  onUpdate: (scores: LeaderboardEntry[], currentUserEntry: LeaderboardEntry | null) => void
): Promise<void> => {
  try {
    console.log('Loading leaderboard...');
    const myWallet = sessionStorage.getItem("flappy_wallet")?.toLowerCase() || "";
    console.log('My wallet:', myWallet);

    const scoresRef = ref(db, "scores");
    const topScoresQuery = query(scoresRef, orderByChild("score"), limitToLast(10));

    onValue(topScoresQuery, async (snapshot) => {
      try {
        console.log('Firebase snapshot received');
        const scores: LeaderboardEntry[] = [];
        let currentUserEntry: LeaderboardEntry | null = null;

        snapshot.forEach((child) => {
          const entry = child.val();
          console.log('Score entry:', entry);
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
        console.log('Processed scores:', scores);
        console.log('Current user entry:', currentUserEntry);
        
        onUpdate(scores, currentUserEntry);
      } catch (error) {
        console.error('Error processing snapshot:', error);
        // Still call onUpdate with empty data so loading stops
        onUpdate([], null);
      }
    }, (error) => {
      console.error('Firebase onValue error:', error);
      // Call onUpdate with empty data so loading stops
      onUpdate([], null);
    });
  } catch (error) {
    console.error('Error in loadLeaderboard:', error);
    // Call onUpdate with empty data so loading stops
    onUpdate([], null);
  }
};
