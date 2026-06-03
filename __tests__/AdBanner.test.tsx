import AdBanner from '@/components/ui/AdBanner';
import { render } from '@testing-library/react-native';
import React from 'react';

// 1. Mock the design system constants so they don't break the layout render
jest.mock('@/constants/design', () => ({
  Radius: { lg: 8 },
  Spacing: { xs: 4, sm: 8, md: 16 },
}));

// 2. Mock custom hook styles and notifications helpers
jest.mock('@/hooks/notifications', () => ({
  getAdMobBannerUnitId: jest.fn(() => 'test-ad-unit-id'),
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/hooks/use-theme-color', () => ({
  useThemeColor: jest.fn((_props, key) => {
    const mockTheme: Record<string, string> = {
      cardSky: '#E0F2FE',
      cardSkyBorder: '#BAE6FD',
      cardSkyText: '#0369A1',
      mutedText: '#64748B',
    };
    return mockTheme[key] || '#000000';
  }),
}));

// 3. Mock Expo Constants to simulate running inside Expo Go local environment
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    appOwnership: 'expo', 
  },
}));

describe('AdBanner Component Test Suite (Melsa)', () => {
  // --- UNIT TEST 1 ---
  it('should render the fallback preview card texts when running outside an APK environment', () => {
    const { getByText } = render(<AdBanner />);

    expect(getByText('AdMob Preview')).toBeTruthy();
    expect(getByText('Real ads appear in APK / dev build')).toBeTruthy();
  });

  // --- UNIT TEST 2 ---
  it('should safely match its container visual bounds and styling rules', () => {
    const { getByText } = render(<AdBanner />);
    
    const titleText = getByText('AdMob Preview');
    
    expect(titleText.props.style).toContainEqual(
      expect.objectContaining({
        fontSize: 13,
        fontWeight: '700',
      })
    );
  });

  // --- INTEGRATION TEST ---
  it('should correctly adapt layout presentation layers based on the active color scheme hooks', () => {
    const { getByText } = render(<AdBanner />);
    
    const titleText = getByText('AdMob Preview');
    const containerCard = titleText.parent?.parent; 

    expect(containerCard).toBeDefined();
    expect(containerCard?.props.style).toContainEqual(
      expect.objectContaining({
        borderWidth: 2,
      })
    );
  });
});