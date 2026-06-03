import {
  type ActivityCardColour,
  useActivityCardColours,
} from '@/components/ui/activity-card';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/design';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

export type PanelTheme = ReturnType<typeof useActivityCardColours>;

const PanelThemeContext = React.createContext<PanelTheme | null>(null);

export function useOptionalPanelTheme(): PanelTheme | null {
  return React.useContext(PanelThemeContext);
}

export function usePanelTheme(): PanelTheme {
  const ctx = useOptionalPanelTheme();
  if (!ctx) {
    throw new Error('usePanelTheme must be used within ColorPanel');
  }
  return ctx;
}

/** Text/surface/border colors for fields inside a ColorPanel (pastel bg stays light in dark mode). */
export function usePanelFieldColors() {
  const panel = useOptionalPanelTheme();
  const foreground = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'mutedText');
  const surface = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');

  if (!panel) {
    return { foreground, muted, surface, border, onPanel: false as const };
  }

  return {
    foreground: panel.textColor,
    muted: panel.textColor,
    surface: panel.cardIconBg,
    border: panel.borderColor,
    onPanel: true as const,
  };
}

/** Body text for use inside ColorPanel / ActivityStepPanel (dark ink on light pastel in every theme). */
export function PanelText({
  children,
  style,
  subdued = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  subdued?: boolean;
}) {
  const { textColor } = usePanelTheme();
  return (
    <Text style={[{ color: textColor, opacity: subdued ? 0.78 : 1 }, style]}>{children}</Text>
  );
}

export function usePanelTableTokens() {
  const { textColor, borderColor } = usePanelTheme();
  return { textColor, borderColor };
}

type ColorPanelProps = {
  colour?: ActivityCardColour;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function ColorPanel({ colour = 'lavender', children, style }: ColorPanelProps) {
  const panel = useActivityCardColours(colour);

  return (
    <PanelThemeContext.Provider value={panel}>
      <View
        style={[
          styles.colorPanelOuter,
          { borderColor: panel.borderColor, borderBottomColor: panel.shadowColor },
          style,
        ]}>
        <View style={[styles.colorPanelInner, { backgroundColor: panel.backgroundColor }]}>
          {children}
        </View>
      </View>
    </PanelThemeContext.Provider>
  );
}

export function PanelTitle({ children }: { children: React.ReactNode }) {
  const { textColor } = usePanelTheme();
  return <Text style={[styles.panelTitle, { color: textColor }]}>{children}</Text>;
}

export function PanelMuted({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { textColor } = usePanelTheme();
  return <Text style={[{ color: textColor, opacity: 0.78 }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  colorPanelOuter: {
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: Radius.xl,
  },
  colorPanelInner: {
    borderRadius: Radius.xl - 2,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  panelTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
});
