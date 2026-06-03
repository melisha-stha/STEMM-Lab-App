import { getTeamData } from '@/hooks/storage';
import {
  resolveLearningTier,
  type LearningTier,
} from '@/utils/formatters/learning-tier';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

/** Loads team learning tier on mount and whenever the screen regains focus (e.g. after team edit). */
export function useLearningTier(defaultTier: LearningTier = 'lower_secondary') {
  const [learningTier, setLearningTier] = useState<LearningTier>(defaultTier);
  const [loading, setLoading] = useState(true);

  const refreshLearningTier = useCallback(async () => {
    const teamData = await getTeamData();
    setLearningTier(resolveLearningTier(teamData));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshLearningTier();
    }, [refreshLearningTier])
  );

  return { learningTier, loading, refreshLearningTier };
}
