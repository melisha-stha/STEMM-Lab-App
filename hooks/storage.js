import AsyncStorage from '@react-native-async-storage/async-storage';

// Logic to SAVE the team info
export const saveTeamData = async (teamName, members, grade, extra = {}) => {
  try {
    const existing = await getTeamData();
    const teamObj = {
      name: teamName,
      members: members,
      grade: grade,
      yearLevel: extra.yearLevel ?? existing?.yearLevel ?? grade,
      learningLevel: extra.learningLevel ?? existing?.learningLevel ?? null,
      avatarKey: extra.avatarKey ?? existing?.avatarKey ?? 'frog',
      id: existing?.id ?? Math.floor(1000 + Math.random() * 9000),
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
    if (jsonValue == null) return null;
    const parsed = JSON.parse(jsonValue);
    if (parsed && typeof parsed === 'object' && !parsed.avatarKey) {
      parsed.avatarKey = 'frog';
    }
    return parsed;
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

const EARTHQUAKE_RESULTS_KEY = '@earthquake_results';

export const saveEarthquakeResults = async (payload) => {
  try {
    const existing = await AsyncStorage.getItem(EARTHQUAKE_RESULTS_KEY);
    const history = existing ? JSON.parse(existing) : [];
    const next = Array.isArray(history) ? [payload, ...history] : [payload];
    await AsyncStorage.setItem(EARTHQUAKE_RESULTS_KEY, JSON.stringify(next));
    console.log('Success: Earthquake results saved.');
  } catch (e) {
    console.error('Failed to save earthquake results', e);
  }
};

export const getEarthquakeResults = async () => {
  try {
    const existing = await AsyncStorage.getItem(EARTHQUAKE_RESULTS_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error('Failed to load earthquake results', e);
    return [];
  }
};

const REACTION_RESULTS_KEY = '@reaction_results';

export const saveReactionResults = async (payload) => {
  try {
    const existing = await AsyncStorage.getItem(REACTION_RESULTS_KEY);
    const history = existing ? JSON.parse(existing) : [];
    const next = Array.isArray(history) ? [payload, ...history] : [payload];
    await AsyncStorage.setItem(REACTION_RESULTS_KEY, JSON.stringify(next));
    console.log('Success: Reaction results saved.');
  } catch (e) {
    console.error('Failed to save reaction results', e);
  }
};

export const getReactionResults = async () => {
  try {
    const existing = await AsyncStorage.getItem(REACTION_RESULTS_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error('Failed to load reaction results', e);
    return [];
  }
};

const BREATHING_RESULTS_KEY = '@breathing_results';

export const saveBreathingResults = async (payload) => {
  try {
    const existing = await AsyncStorage.getItem(BREATHING_RESULTS_KEY);
    const history = existing ? JSON.parse(existing) : [];
    const next = Array.isArray(history) ? [payload, ...history] : [payload];
    await AsyncStorage.setItem(BREATHING_RESULTS_KEY, JSON.stringify(next));
    console.log('Success: Breathing results saved.');
  } catch (e) {
    console.error('Failed to save breathing results', e);
  }
};

export const getBreathingResults = async () => {
  try {
    const existing = await AsyncStorage.getItem(BREATHING_RESULTS_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error('Failed to load breathing results', e);
    return [];
  }
};

const SOUND_RESULTS_KEY = '@sound_results';

export const saveSoundResults = async (payload) => {
  try {
    const existing = await AsyncStorage.getItem(SOUND_RESULTS_KEY);
    const history = existing ? JSON.parse(existing) : [];
    const next = Array.isArray(history) ? [payload, ...history] : [payload];
    await AsyncStorage.setItem(SOUND_RESULTS_KEY, JSON.stringify(next));
    console.log('Success: Sound results saved.');
  } catch (e) {
    console.error('Failed to save sound results', e);
  }
};

export const getSoundResults = async () => {
  try {
    const existing = await AsyncStorage.getItem(SOUND_RESULTS_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error('Failed to load sound results', e);
    return [];
  }
};

const PERFORMANCE_RESULTS_KEY = '@performance_results';

export const savePerformanceResults = async (payload) => {
  try {
    const existing = await AsyncStorage.getItem(PERFORMANCE_RESULTS_KEY);
    const history = existing ? JSON.parse(existing) : [];
    const next = Array.isArray(history) ? [payload, ...history] : [payload];
    await AsyncStorage.setItem(PERFORMANCE_RESULTS_KEY, JSON.stringify(next));
    console.log('Success: Performance results saved.');
  } catch (e) {
    console.error('Failed to save performance results', e);
  }
};

export const getPerformanceResults = async () => {
  try {
    const existing = await AsyncStorage.getItem(PERFORMANCE_RESULTS_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error('Failed to load performance results', e);
    return [];
  }
};

const HANDFAN_RESULTS_KEY = '@handfan_results';

export const saveHandFanResults = async (payload) => {
  try {
    const existing = await AsyncStorage.getItem(HANDFAN_RESULTS_KEY);
    const history = existing ? JSON.parse(existing) : [];
    const next = Array.isArray(history) ? [payload, ...history] : [payload];
    await AsyncStorage.setItem(HANDFAN_RESULTS_KEY, JSON.stringify(next));
    console.log('Success: Hand Fan results saved.');
  } catch (e) {
    console.error('Failed to save hand fan results', e);
  }
};

export const getHandFanResults = async () => {
  try {
    const existing = await AsyncStorage.getItem(HANDFAN_RESULTS_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error('Failed to load hand fan results', e);
    return [];
  }
};

const COLOR_SCHEME_KEY = '@app_color_scheme';

/** @returns {'light' | 'dark' | null} */
export const getColorSchemePreference = async () => {
  try {
    const value = await AsyncStorage.getItem(COLOR_SCHEME_KEY);
    if (value === 'light' || value === 'dark') return value;
    return null;
  } catch (e) {
    console.error('Failed to load color scheme preference', e);
    return null;
  }
};

/** @param {'light' | 'dark'} scheme */
export const saveColorSchemePreference = async (scheme) => {
  try {
    await AsyncStorage.setItem(COLOR_SCHEME_KEY, scheme);
  } catch (e) {
    console.error('Failed to save color scheme preference', e);
  }
};