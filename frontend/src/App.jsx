import React from 'react';
import { useHQ } from './hooks/useHQ';
import Shell from './components/layout/Shell';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import CourseBrief from './pages/CourseBrief/CourseBrief';
import NewCourseModal from './pages/Courses/NewCourseModal';
import Campaigns from './pages/Campaigns/Campaigns';
import CampaignWizard from './pages/CampaignWizard/CampaignWizard';
import CampaignDetail from './pages/CampaignDetail/CampaignDetail';
import SourceDetail from './pages/SourceDetail/SourceDetail';
import CreatorBank from './pages/CreatorBank/CreatorBank';
import SourceProfile from './pages/SourceProfile/SourceProfile';
import Copilot from './pages/Copilot/Copilot';
import Artifacts from './pages/Artifacts/Artifacts';
import Settings from './pages/Settings/Settings';

export default function App() {
  const { HQ, s } = useHQ();
  const route = s.route || { name: 'dashboard' };

  if (!s.user || !s.module) {
    return <Login />;
  }

  // Active view inside Shell
  const renderPage = () => {
    switch (route.name) {
      case 'dashboard':
        return <Dashboard />;
      case 'brief':
        return <CourseBrief />;
      case 'campaigns':
        return <Campaigns />;
      case 'wizard':
        return <CampaignWizard />;
      case 'campaign':
        return <CampaignDetail />;
      case 'influencer':
        return <SourceDetail />;
      case 'creators':
        return <CreatorBank />;
      case 'creator':
        return <SourceProfile />;
      case 'copilot':
        return <Copilot mode="page" />;
      case 'files':
        return <Artifacts />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Shell>
      {renderPage()}
      {route.name === 'newfilm' && (
        <NewCourseModal onClose={() => HQ.go('dashboard')} />
      )}
    </Shell>
  );
}
