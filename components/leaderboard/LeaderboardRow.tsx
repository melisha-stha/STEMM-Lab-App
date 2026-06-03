import { usePanelTheme } from '@/components/ui/activity-color-panel';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
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

export type LeaderboardRowProps = {
  rank: number;
  avatarKey?: string;
  teamName: string;
  discriminator: string;
  yearLabel?: string | null;
  metricPrimary?: string;
  metricLabel?: string;
  pointsLine?: string;
  compact?: boolean;
};

export function LeaderboardRow({
  rank,
  avatarKey,
  teamName,
  discriminator,
  yearLabel,
  metricPrimary,
  metricLabel,
  pointsLine,
  compact,
}: LeaderboardRowProps) {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const gold = useThemeColor({}, 'gold');
  const isPodium = rank <= 3;
  const avatarSource = getAvatarSource(avatarKey);

  return (
    <View
      style={[
        styles.row,
        compact ? styles.rowCompact : null,
        {
          borderColor: isPodium ? gold : borderColor,
          backgroundColor: cardIconBg,
        },
      ]}>
      <View style={[styles.rankWrap, { borderColor: isPodium ? gold : borderColor }]}>
        <Text style={[styles.rank, { color: isPodium ? gold : textColor }]}>{rank}</Text>
      </View>
      <View style={[styles.avatarWrap, { borderColor: isPodium ? gold : borderColor }]}>
        {avatarSource ? (
          <Image source={avatarSource} style={styles.avatar} contentFit="cover" />
        ) : null}
      </View>
      <View style={styles.main}>
        <Text style={[styles.teamId, { color: textColor }]} numberOfLines={1}>
          {teamName}
        </Text>
        <Text style={[styles.meta, { color: textColor, opacity: 0.75 }]} numberOfLines={1}>
          Team ID {discriminator}
          {yearLabel ? ` · ${yearLabel}` : ''}
        </Text>
        {pointsLine ? (
          <Text style={[styles.meta, { color: textColor, opacity: 0.9 }]} numberOfLines={1}>
            {pointsLine}
          </Text>
        ) : null}
        {metricLabel && metricPrimary ? (
          <Text style={[styles.meta, { color: textColor, opacity: 0.9 }]} numberOfLines={1}>
            {metricLabel}: {metricPrimary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowCompact: {
    paddingVertical: Spacing.sm,
  },
  rankWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  rank: {
    fontWeight: '900',
    fontSize: FontSize.md,
    fontVariant: ['tabular-nums'],
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
  avatar: {
    width: '100%',
    height: '100%',
  },
  main: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  teamId: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  meta: {
    fontSize: FontSize.xs,
  },
});
