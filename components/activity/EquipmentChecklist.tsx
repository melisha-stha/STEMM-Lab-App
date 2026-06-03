import { PanelMuted, usePanelTheme } from '@/components/ui/activity-color-panel';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type EquipmentChecklistVariant = 'standard' | 'performance' | 'compact';

export type EquipmentChecklistProps = {
  items: readonly string[];
  variant?: EquipmentChecklistVariant;
  readyMessage?: string;
};

const DEFAULT_READY = "You're good to go!";
const DEFAULT_INTRO = 'First, gather all this equipment:';
const DEFAULT_SELECT_HINT = 'Select all equipment you have gathered';

export function EquipmentChecklist({
  items,
  variant = 'standard',
  readyMessage = DEFAULT_READY,
}: EquipmentChecklistProps) {
  const { textColor, borderColor, cardIconBg } = usePanelTheme();
  const success = useThemeColor({}, 'success' as any) ?? '#4CAF50';
  const error = useThemeColor({}, 'error' as any) ?? '#F44336';
  const isPerformance = variant === 'performance';
  const isCompact = variant === 'compact';
  const showIntro = variant === 'standard';

  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item, false]))
  );

  const missingItems = items.filter((item) => !checked[item]);
  const allGathered = missingItems.length === 0;
  const hasStartedSelecting = items.some((item) => checked[item]);

  const toggleEquipment = (item: string) => {
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }));
  };

  const iconSize = isPerformance ? 20 : 22;
  const rowStyle = isPerformance ? styles.equipmentRow : styles.equipmentCheckRow;
  const labelStyle = isPerformance ? styles.equipmentText : styles.equipmentCheckLabel;
  const uncheckedWeight = isPerformance ? '600' : '500';

  return (
    <>
      {showIntro ? (
        <PanelMuted style={styles.equipmentIntro}>{DEFAULT_INTRO}</PanelMuted>
      ) : null}
      <PanelMuted
        style={
          isPerformance
            ? styles.bodyMuted
            : isCompact
              ? styles.equipmentSelectHintCompact
              : styles.equipmentSelectHint
        }>
        {DEFAULT_SELECT_HINT}
      </PanelMuted>

      <View style={[styles.equipmentChecklist, isPerformance ? styles.equipmentChecklistPerformance : null]}>
        {items.map((item) => {
          const isChecked = checked[item];
          return (
            <Pressable
              key={item}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isChecked }}
              accessibilityLabel={item}
              onPress={() => toggleEquipment(item)}
              style={[
                rowStyle,
                {
                  borderColor: isChecked ? success : borderColor,
                  backgroundColor: cardIconBg,
                },
              ]}>
              <MaterialIcons
                name={isChecked ? 'check-box' : 'check-box-outline-blank'}
                size={iconSize}
                color={isChecked ? success : borderColor}
              />
              <Text
                style={[
                  labelStyle,
                  { color: textColor, fontWeight: isChecked ? '700' : uncheckedWeight },
                ]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {allGathered ? (
        <View style={[styles.equipmentStatusBanner, { backgroundColor: cardIconBg, borderColor: success }]}>
          <MaterialIcons name="celebration" size={20} color={success} />
          <Text style={[styles.equipmentStatusText, { color: success }]}>{readyMessage}</Text>
        </View>
      ) : hasStartedSelecting ? (
        <View style={[styles.equipmentStatusBanner, { backgroundColor: cardIconBg, borderColor: error }]}>
          <MaterialIcons name="warning" size={20} color={error} />
          <View style={styles.missingEquipmentBlock}>
            <Text style={[styles.equipmentStatusText, { color: error }]}>Missing equipment:</Text>
            {missingItems.map((item) => (
              <Text key={item} style={[styles.missingEquipmentItem, { color: error }]}>
                • {item}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  equipmentIntro: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: FontWeight.semibold,
  },
  equipmentSelectHint: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  equipmentSelectHintCompact: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.xs,
    fontWeight: FontWeight.semibold,
  },
  bodyMuted: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.88,
  },
  equipmentChecklist: {
    gap: Spacing.xs,
  },
  equipmentChecklistPerformance: {
    marginTop: Spacing.sm,
  },
  equipmentCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  equipmentCheckLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  equipmentText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  equipmentStatusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  equipmentStatusText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  missingEquipmentBlock: {
    flex: 1,
    gap: 4,
  },
  missingEquipmentItem: {
    fontSize: FontSize.sm,
    lineHeight: 18,
    fontWeight: FontWeight.semibold,
  },
});
