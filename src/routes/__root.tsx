import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useSettingsStore } from '@/features/settings/stores/settings-store';

function RootComponent() {
  const appTheme = useSettingsStore((s) => s.appTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = appTheme;
  }, [appTheme]);

  return (
    <>
      <Outlet />
    </>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
