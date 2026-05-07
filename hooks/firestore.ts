import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "firebase/firestore";
import { db } from './firebaseConfig';

export const uploadParachuteResult = async (userId: string, teamData: any, attempts: any[], location?: any) => {
  try {
    const finalTeamName = teamData?.name || "Anonymous Team";
    const finalGrade = teamData?.grade || "N/A";

    const sanitizedLocation = location ? {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude)
    } : null;

    const docRef = await addDoc(collection(db, "parachute_results"), {
      userId: userId,
      teamName: finalTeamName, 
      grade: finalGrade,       
      attempts: attempts,
      bestTime: Math.max(...attempts.map(a => a.time)), 
      location: sanitizedLocation,
      createdAt: serverTimestamp(),
    });

    console.log("Document written with ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error syncing data to Firestore: ", error);
    throw error;
  }
};

export const subscribeToLeaderboard = (callback: (data: any[]) => void) => {
  const q = query(
    collection(db, "parachute_results"), 
    orderBy("bestTime", "desc"), // Slowest flight (highest number) at the top
    limit(10)
  );

  return onSnapshot(q, (snapshot) => {
    const results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(results);
  });
};