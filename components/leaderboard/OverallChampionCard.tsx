import { usePanelTheme } from '@/components/ui/activity-color-panel';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { OverallTeamStanding } from '@/utils/scoring/leaderboard-scoring';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const AVATAR_SOURCE: Record<string, number> = {
  ben: require('@/assets/images/boy-avatar.png'),
  girl: require('@/assets/images/girl-avatar.png'),
  frog: require('@/assets/images/frog-avatar.png'),
  bunny: require('@/assets/images/bunny-avatar.png'),
  cat: require('@/assets/images/cat-avatar.png'),
  fox: require('@/assets/images/fox-avatar.png'),
};

const getAvatarSource = (key?: string | null) => {
  if (!key) return null;
  return AVATAR_SOURCE[key] ?? null;
};

export type OverallChampionCardProps = {
  champion: OverallTeamStanding;
  avatarKey?: string;
};

export function OverallChampionCard({ champion, avatarKey }: OverallChampionCardProps) {
  const { textColor, cardIconBg } = usePanelTheme();
  const gold = useThemeColor({}, 'gold');
  const avatarSource = getAvatarSource(avatarKey);

  return (
    <View style={[styles.championCard, { borderColor: gold, backgroundColor: cardIconBg }]}>
      <View style={styles.championRow}>
        <View style={[styles.avatarWrap, styles.championAvatar, { borderColor: gold }]}>
          {avatarSource ? (
            <Image source={avatarSource} style={styles.avatar} contentFit="cover" />
          ) : null}
        </View>
        <View style={styles.championMeta}>
          <Text style={[styles.championTeam, { color: textColor }]} numberOfLines={2}>
            {champion.teamName}
          </Text>
          <Text style={[styles.championPoints, { color: gold }]}>
            {champion.totalPoints} points · {champion.activitiesCompleted} activities
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  championCard: {
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  championRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
    flexShrink: 0,
  },
  championAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  championMeta: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  championTeam: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
  },
  championPoints: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
