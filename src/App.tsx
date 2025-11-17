import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { ExplorePage } from './components/pages/ExplorePage';
import { IconStudioPage } from './components/pages/IconStudioPage';
import { Studio3DPage } from './components/pages/Studio3DPage';
import { ImageStudioPage } from './components/pages/ImageStudioPage';
import { Toast } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Studio2DPage } from './features/studio/2d/components/Studio2DPage';

const AppPages: React.FC = () => {
  const { currentPage } = useApp();

  switch (currentPage) {
    case 'page-icons':
      return <IconStudioPage />;
    case 'page-id-2d':
      return <Studio2DPage />;
    case 'page-id-3d':
      return <Studio3DPage />;
    case 'page-image':
      return <ImageStudioPage />;
    case 'page-usages':
    default:
      return <ExplorePage />;
  }
};

const AppShell: React.FC = () => (
  <div className="app-container">
    <Header />
    <main className="app-main" style={{ flex: 1, overflow: 'hidden' }}>
      <AppPages />
    </main>
  </div>
);

const App: React.FC = () => (
  <AppProvider>
    <ErrorBoundary>
      <AppShell />
      <Toast />
    </ErrorBoundary>
  </AppProvider>
);

export default App;