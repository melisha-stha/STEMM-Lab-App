export const uploadHandFanResult = async (
  userId: string,
  teamData: any,
  designs: any[],
  prediction: string,
  wereYouRight: string,
  surprises: string,
  locationData: any
) => {
  const docRef = await addDoc(collection(db, 'handfanResults'), {
    userId,
    teamName: teamData?.name || 'unknown',
    grade: teamData?.grade || '',
    designs,
    prediction,
    wereYouRight,
    surprises,
    locationData,
    createdAt: new Date().toISOString(),
  });
  console.log('Hand Fan result saved with ID:', docRef.id);
};