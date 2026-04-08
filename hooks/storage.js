import AsyncStorage from '@react-native-async-storage/async-storage';

// Logic to SAVE the team info
export const saveTeamData = async (teamName, members, grade) => {
  try {
    const teamObj = {
      name: teamName,
      members: members, // Stores the list of names 
      grade: grade, // Stores the year level 
      id: Math.floor(1000 + Math.random() * 9000) 
    };
    const jsonValue = JSON.stringify(teamObj);
    await AsyncStorage.setItem('@team_info', jsonValue);
    console.log("Success: Team data saved locally.");
  } catch (e) {
    console.error("Failed to save team data", e);
  }
};

// Logic to LOAD the team info later
export const getTeamData = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem('@team_info');
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error("Failed to load team data", e);
  }
};

export const clearTeamData = async () => {
  try {
    await AsyncStorage.removeItem('@team_info');
    console.log('Success: Team data cleared.');
  } catch (e) {
    console.error('Failed to clear team data', e);
  }
};

const PARACHUTE_RESULTS_KEY = '@parachute_results';

export const saveParachuteResults = async (payload) => {
  try {
    const existing = await AsyncStorage.getItem(PARACHUTE_RESULTS_KEY);
    const history = existing ? JSON.parse(existing) : [];
    const next = Array.isArray(history) ? [payload, ...history] : [payload];
    await AsyncStorage.setItem(PARACHUTE_RESULTS_KEY, JSON.stringify(next));
    console.log('Success: Parachute results saved.');
  } catch (e) {
    console.error('Failed to save parachute results', e);
  }
};

export const getParachuteResults = async () => {
  try {
    const existing = await AsyncStorage.getItem(PARACHUTE_RESULTS_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error('Failed to load parachute results', e);
    return [];
  }
};