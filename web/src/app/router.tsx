import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { PublicLayout } from '@/components/layout/public-layout'
import { ADMIN_ROLES, FINANCE_ROLES, READER_ROLES } from '@/config/navigation'
import { RequireAuth, RequireRole } from '@/features/auth/guards'
import { ForbiddenPage, NotFoundPage, RouteError } from '@/features/misc/pages/status-pages'

const HomePage = lazy(() => import('@/features/landing/pages/home-page'))
const LoginPage = lazy(() => import('@/features/auth/pages/login-page'))
const AuthCallbackPage = lazy(() => import('@/features/auth/pages/auth-callback-page'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/forgot-password-page'))
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/reset-password-page'))

const DashboardPage = lazy(() => import('@/features/dashboard/pages/dashboard-page'))
const ProfilePage = lazy(() => import('@/features/profile/pages/profile-page'))
const MyChargesPage = lazy(() => import('@/features/billing/pages/my-charges-page'))
const ChargesPage = lazy(() => import('@/features/charges/pages/charges-page'))
const MassAccrualPage = lazy(() => import('@/features/charges/pages/mass-accrual-page'))
const PaymentsPage = lazy(() => import('@/features/payments/pages/payments-page'))
const DebtorsPage = lazy(() => import('@/features/debtors/pages/debtors-page'))
const ReportsPage = lazy(() => import('@/features/reports/pages/reports-page'))
const MembersPage = lazy(() => import('@/features/members/pages/members-page'))
const PlotsPage = lazy(() => import('@/features/plots/pages/plots-page'))
const TariffsPage = lazy(() => import('@/features/tariffs/pages/tariffs-page'))
const ContributionTypesPage = lazy(
  () => import('@/features/contribution-types/pages/contribution-types-page')
)
const WaterMetersPage = lazy(() => import('@/features/meters/pages/water-meters-page'))
const ElectricityMetersPage = lazy(
  () => import('@/features/meters/pages/electricity-meters-page')
)
const MetersHubPage = lazy(() => import('@/features/meters/pages/meters-hub-page'))
const IntegrationTestPage = lazy(
  () => import('@/features/integration/pages/integration-test-page')
)
const UsersPage = lazy(() => import('@/features/admin/pages/users-page'))
const RolesPage = lazy(() => import('@/features/admin/pages/roles-page'))
const SettingsPage = lazy(() => import('@/features/admin/pages/settings-page'))

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'integration-test', element: <IntegrationTestPage /> },
          { path: 'me', element: <ProfilePage /> },
          { path: 'me/bills', element: <MyChargesPage /> },
          {
            element: <RequireRole allow={READER_ROLES} />,
            children: [
              { path: 'members', element: <MembersPage /> },
              { path: 'plots', element: <PlotsPage /> },
              { path: 'tariffs', element: <TariffsPage /> },
              { path: 'contribution-types', element: <ContributionTypesPage /> },
              { path: 'contributions', element: <ContributionTypesPage /> },
              { path: 'water-meters', element: <WaterMetersPage /> },
              { path: 'electricity-meters', element: <ElectricityMetersPage /> },
              { path: 'meters', element: <MetersHubPage /> },
              { path: 'meters/water', element: <WaterMetersPage /> },
              { path: 'meters/electricity', element: <ElectricityMetersPage /> },
            ],
          },
          {
            element: <RequireRole allow={FINANCE_ROLES} />,
            children: [
              { path: 'charges', element: <ChargesPage /> },
              { path: 'accruals', element: <ChargesPage /> },
              { path: 'accruals/mass', element: <MassAccrualPage /> },
              { path: 'payments', element: <PaymentsPage /> },
              { path: 'debtors', element: <DebtorsPage /> },
              { path: 'reports', element: <ReportsPage /> },
            ],
          },
          {
            element: <RequireRole allow={ADMIN_ROLES} />,
            children: [
              { path: 'users', element: <UsersPage /> },
              { path: 'roles', element: <RolesPage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
          { path: '403', element: <ForbiddenPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage />, errorElement: <RouteError /> },
])