import { Stack } from "expo-router";

import { AppSettingsProvider } from "../context/AppSettingsContext";

export default function RootLayout() {
  return (
    <AppSettingsProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </AppSettingsProvider>
  );
}
