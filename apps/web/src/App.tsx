import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AppHome } from './app/AppHome'
import { AppShell } from './app/AppShell'
import { AuthCallback } from './app/AuthCallback'
import { ForgotPasswordPage } from './app/ForgotPasswordPage'
import { LoginPage } from './app/LoginPage'
import { ResetPasswordPage } from './app/ResetPasswordPage'
import { ClaimInvitePage } from './app/ClaimInvitePage'
import { ProfilePage } from './app/ProfilePage'
import { ProfileSettingsPage } from './app/ProfileSettingsPage'
import { TreeCreatePage } from './app/TreeCreatePage'
import { TreeDetailLayout } from './app/TreeDetailLayout'
import { TreeOverviewPage } from './app/TreeOverviewPage'
import { TreeChartPage } from './app/TreeChartPage'
import { TreeMembersPage } from './app/TreeMembersPage'
import { TreesListPage } from './app/TreesListPage'
import { ChatShell } from './app/chat/ChatShell'
import { ChatThreadPage } from './app/chat/ChatThreadPage'
import { ConnectionsPage } from './app/ConnectionsPage'
import { RequireAuth } from './auth/RequireAuth'
import { LandingPage } from './pages/landing/LandingPage'
import { LandingLayout } from './pages/landing/LandingLayout'
import { RoadmapPage } from './pages/landing/RoadmapPage'

function TreeFeedRedirectsToOverview() {
  const { treeId } = useParams<{ treeId: string }>()
  return <Navigate to={`/app/trees/${treeId ?? ''}/overview`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route element={<LandingLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
      </Route>

      <Route path="/app/login" element={<LoginPage />} />
      <Route path="/app/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/app/reset-password" element={<ResetPasswordPage />} />
      <Route path="/app/auth/callback" element={<AuthCallback />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<AppHome />} />
        <Route path="profile/settings" element={<ProfileSettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="u/:userId" element={<ProfilePage />} />
        <Route path="claim-invite" element={<ClaimInvitePage />} />
        <Route path="connections" element={<ConnectionsPage />} />
        <Route path="chat" element={<ChatShell />}>
          <Route path=":conversationId" element={<ChatThreadPage />} />
        </Route>
        <Route path="trees" element={<TreesListPage />} />
        <Route path="trees/new" element={<TreeCreatePage />} />
        <Route path="trees/:treeId" element={<TreeDetailLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<TreeOverviewPage />} />
          <Route path="chart" element={<TreeChartPage />} />
          <Route path="members" element={<TreeMembersPage />} />
          <Route path="feed" element={<TreeFeedRedirectsToOverview />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
