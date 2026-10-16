import React, { useEffect, useState } from 'react';
import { useHQ } from './hooks/useHQ';
import Shell from './components/layout/Shell';
import { api } from './lib/api';
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
  const [authChecking, setAuthChecking] = useState(() => !!api.token.get() && !s.user);
  const route = s.route || { name: 'dashboard' };

  useEffect(() => {
    const token = api.token.get();
    if (token && !s.user) {
      api.get('/auth/me')
        .then((res) => {
          if (res?.user) {
            HQ.set((z) => {
              z.user = res.user;
              z.module = z.module || 'hire';
            });
          }
        })
        .catch(() => {
          api.token.set(null);
          HQ.set((z) => {
            z.user = null;
          });
        })
        .finally(() => {
          setAuthChecking(false);
        });
    } else {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    if (s.user) {
      api.get('/courses')
        .then((list) => {
          if (Array.isArray(list) && list.length > 0) {
            HQ.set((z) => {
              list.forEach((c) => {
                const ex = (z.films || []).find((f) => f.id === c.id);
                if (ex) {
                  ex.title = c.title;
                  ex.batch = c.batch;
                  ex.release = c.batch_start || ex.release;
                  ex.provider = c.provider;
                  ex.readiness = c.readiness;
                } else {
                  z.films.push({
                    id: c.id,
                    title: c.title,
                    batch: c.batch || 'Batch 1',
                    language: 'Telugu',
                    release: c.batch_start || '2026-11-16',
                    provider: c.provider || 'Nexa Skills Foundation',
                    form: {},
                    brief: {
                      courseName: c.title,
                      courseLink: '',
                      domain: '',
                      level: 'Beginner',
                      eligibility: '',
                      stipend: '',
                      fee: '',
                      mode: '',
                      duration: ''
                    },
                    flags: [],
                    reads: [],
                    claims: [],
                    files: [],
                    readiness: c.readiness
                  });
                }
              });
              if (!z.films.some((f) => f.id === z.filmId)) {
                z.filmId = list[0].id;
              }
            });
          }
        })
        .catch(() => {});
    }
  }, [s.user]);

  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ink-25)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <span style={{ width: '28px', height: '28px', borderRadius: '50%', border: '3px solid var(--teal-200)', borderTopColor: 'var(--teal-700)', animation: 'spin .8s linear infinite' }}></span>
          <span style={{ fontSize: '14px', color: 'var(--ink-600)', fontWeight: 500 }}>Verifying session…</span>
        </div>
      </div>
    );
  }

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
