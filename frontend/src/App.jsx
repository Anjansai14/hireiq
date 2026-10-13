import React from 'react';
import { useHQ } from './hooks/useHQ';
import Shell from './components/layout/Shell';
import {
  LoginScreen,
  DashboardScreen,
  CourseBriefScreen,
  NewCourseModal,
  CampaignsScreen,
  CampaignWizardScreen,
  CampaignDetailScreen,
  SourceDetailScreen,
  CreatorBankScreen,
  SourceProfileScreen,
  CopilotScreen,
  ArtifactsScreen,
  SettingsScreen
} from './screens';

export default function App() {
  const { HQ, s } = useHQ();
  const route = s.route || { name: 'dashboard' };

  if (!s.user || !s.module) {
    return <LoginScreen />;
  }

  // Active view inside Shell
  const renderPage = () => {
    switch (route.name) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'brief':
        return <CourseBriefScreen />;
      case 'campaigns':
        return <CampaignsScreen />;
      case 'wizard':
        return <CampaignWizardScreen />;
      case 'campaign':
        return <CampaignDetailScreen />;
      case 'influencer':
        return <SourceDetailScreen />;
      case 'creators':
        return <CreatorBankScreen />;
      case 'creator':
        return <SourceProfileScreen />;
      case 'copilot':
        return <CopilotScreen mode="page" />;
      case 'files':
        return <ArtifactsScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <DashboardScreen />;
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
