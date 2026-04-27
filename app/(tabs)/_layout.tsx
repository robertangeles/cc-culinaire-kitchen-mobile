import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { fonts, palette, theme } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: palette.copper,
        tabBarInactiveTintColor: palette.inkMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontFamily: fonts.uiBold, fontSize: 20 }}>•</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontFamily: fonts.uiBold, fontSize: 20 }}>·</Text>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: theme.bgElev,
    borderTopColor: theme.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 0.18,
  },
});
