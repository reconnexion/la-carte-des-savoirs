import { Refine, Authenticated } from '@refinedev/core';
import { useNotificationProvider, ThemedLayout, ErrorComponent, RefineThemes } from '@refinedev/antd';
import routerProvider, { CatchAllNavigate, UnsavedChangesNotifier, DocumentTitleHandler } from '@refinedev/react-router';
import { AntdAuthPage } from '@activitypods/refine-providers/antd-auth-page';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router';
import { App as AntdApp, ConfigProvider } from 'antd';

import '@refinedev/antd/dist/reset.css';

import { authProvider, dataProvider, DEFAULT_POD_PROVIDER } from './providers';
import MapPage from './pages/MapPage';
import OnboardingPage from './pages/OnboardingPage';

const App = () => (
  <BrowserRouter>
    <ConfigProvider theme={{ ...RefineThemes.Blue, token: { ...RefineThemes.Blue.token, colorPrimary: '#1677ff' } }}>
      <AntdApp>
        <Refine
          authProvider={authProvider}
          dataProvider={dataProvider}
          routerProvider={routerProvider}
          resources={[
            { name: 'experiences' },
            { name: 'profile' },
            { name: 'location' }
          ]}
          notificationProvider={useNotificationProvider}
          options={{
            syncWithLocation: true,
            warnWhenUnsavedChanges: true,
            disableTelemetry: true
          }}
        >
          <Routes>
            <Route
              element={
                <Authenticated key="authenticated-routes" fallback={<CatchAllNavigate to="/login" />}>
                  <Outlet />
                </Authenticated>
              }
            >
              <Route index element={<MapPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
            </Route>

            {/*
              Not wrapped in <Authenticated>. AntdAuthPage handles every stage (provider picker,
              OAuth callback, app registration) based on URL search params, so this single route
              doubles as the redirectUri authProvider() defaults to.
            */}
            <Route path="/login" element={<AntdAuthPage authProvider={authProvider} defaultPodProvider={DEFAULT_POD_PROVIDER} />} />

            <Route
              element={
                <Authenticated key="catch-all">
                  <ThemedLayout>
                    <Outlet />
                  </ThemedLayout>
                </Authenticated>
              }
            >
              <Route path="*" element={<ErrorComponent />} />
            </Route>
          </Routes>
          <UnsavedChangesNotifier />
          <DocumentTitleHandler />
        </Refine>
      </AntdApp>
    </ConfigProvider>
  </BrowserRouter>
);

export default App;
