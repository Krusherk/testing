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
  name: string;
  wallet: string;
  score: number;
  timestamp: number;
}

export const saveScore = async (score: number): Promise<void> => {
  const discordName = sessionStorage.getItem("flappy_discord");
  const wallet = sessionStorage.getItem("flappy_wallet") || "anon";
  const playerName = discordName || wallet;

  const scoresRef = ref(db, "scores/" + wallet);
  try {
    const snapshot = await get(scoresRef);
    const existing = snapshot.exists() ? snapshot.val().score : 0;
    if (score > existing) {
      await set(scoresRef, {
        name: playerName,
        wallet: wallet,
        score,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error("Error saving score:", error);
  }
};

export const loadLeaderboard = async (
  onUpdate: (scores: LeaderboardEntry[], currentUserEntry: LeaderboardEntry | null) => void
): Promise<void> => {
  const myWallet = (sessionStorage.getItem("flappy_wallet") || "").toLowerCase();
  const myDiscord = sessionStorage.getItem("flappy_discord") || "";

  const scoresRef = ref(db, "scores");
  const topScoresQuery = query(scoresRef, orderByChild("score"), limitToLast(10));

  onValue(topScoresQuery, async (snapshot) => {
    const scores: LeaderboardEntry[] = [];
    snapshot.forEach((child) => {
      scores.push(child.val());
    });
    scores.reverse(); // highest first

    // Fetch Discord usernames
    const discordSnap = await get(ref(db, "discordUsernames"));
    const discordData = discordSnap.exists() ? discordSnap.val() : {};

    // Find my entry
    const allScoresSnap = await get(scoresRef);
    let currentUserEntry: LeaderboardEntry | null = null;
    allScoresSnap.forEach(child => {
      const val = child.val();
      if (val.wallet?.toLowerCase() === myWallet) {
        currentUserEntry = {
          ...val,
          name: myDiscord || discordData[myWallet]?.username || val.name || val.wallet
        };
      }
    });

    // Process display names for leaderboard
    const processedScores = scores.map((entry) => {
      const walletLower = entry.wallet?.toLowerCase();
      const displayName = 
        walletLower === myWallet
          ? currentUserEntry?.name
          : discordData[walletLower]?.username || entry.name || entry.wallet;
      
      return {
        ...entry,
        name: displayName || entry.name
      };
    });

    onUpdate(processedScores, currentUserEntry);
  });
};
