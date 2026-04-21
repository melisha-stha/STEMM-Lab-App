import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from './firebaseConfig';

export const uploadParachuteResult = async (userId: string, teamData: any, attempts: any[]) => {
  try {
    // collection(db, "name") tells Firebase where to put the data
    const docRef = await addDoc(collection(db, "parachute_results"), {
      userId: userId,                // Links result to the specific user account
      teamName: teamData.name,       // Team Name from Onboarding
      grade: teamData.grade,         // Grade level
      attempts: attempts,            // The array of times you recorded
      // Calculate the best time automatically before uploading
      bestTime: Math.min(...attempts.map(a => a.time)), 
      createdAt: serverTimestamp(),  // Uses Google's server clock for fairness
    });

    console.log("Document written with ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error syncing data to Firestore: ", error);
    throw error;
  }
};