import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth, RequirePermission, NotFound } from './auth/guards';
import Layout from './layout/Layout';
import Login from './pages/Login';
import ModulePlaceholder from './pages/ModulePlaceholder';
import RoomsPage from './modules/inventory/pages/RoomsPage';
import RoomTypesPage from './modules/inventory/pages/RoomTypesPage';
import FloorsPage from './modules/inventory/pages/FloorsPage';
import RatePlansPage from './modules/inventory/pages/RatePlansPage';
import InventoryTabs from './modules/inventory/components/InventoryTabs';
import GuestsPage from './modules/guests/pages/GuestsPage';
import ReservationsPage from './modules/reservations/pages/ReservationsPage';
import NewReservationPage from './modules/reservations/pages/NewReservationPage';
import ReservationDetailPage from './modules/reservations/pages/ReservationDetailPage';
import AvailabilityPage from './modules/reservations/pages/AvailabilityPage';
import FrontDeskPage from './modules/frontdesk/pages/FrontDeskPage';
import StayDetailPage from './modules/frontdesk/pages/StayDetailPage';
import FoliosPage from './modules/folio/pages/FoliosPage';
import FolioDetailPage from './modules/folio/pages/FolioDetailPage';
import HousekeepingPage from './modules/operations/pages/HousekeepingPage';
import MaintenancePage from './modules/operations/pages/MaintenancePage';
import ServicesPage from './modules/operations/pages/ServicesPage';
import DashboardPage from './modules/reports/pages/DashboardPage';
import ReportsPage from './modules/reports/pages/ReportsPage';

const MODULES = {
  Settings: {
    title: 'Settings',
    subtitle: 'Hotel settings, users, and audit.',
    permission: 'settings.view',
    phase: 'P1',
  },
};

function ModuleRoute({ name }) {
  const mod = MODULES[name];
  return (
    <RequirePermission permission={mod.permission}>
      <ModulePlaceholder
        title={mod.title}
        subtitle={mod.subtitle}
        phase={mod.phase}
      />
    </RequirePermission>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route
              index
              element={
                <RequirePermission permission="dashboard.view">
                  <DashboardPage />
                </RequirePermission>
              }
            />
            <Route
              path="front-desk"
              element={
                <RequirePermission permission="stays.view">
                  <FrontDeskPage />
                </RequirePermission>
              }
            />
            <Route
              path="stays/:id"
              element={
                <RequirePermission permission="stays.view">
                  <StayDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="reservations"
              element={
                <RequirePermission permission="reservations.view">
                  <ReservationsPage />
                </RequirePermission>
              }
            />
            <Route
              path="reservations/new"
              element={
                <RequirePermission permission="reservations.manage">
                  <NewReservationPage />
                </RequirePermission>
              }
            />
            <Route
              path="reservations/:id"
              element={
                <RequirePermission permission="reservations.view">
                  <ReservationDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="availability"
              element={
                <RequirePermission permission="availability.view">
                  <AvailabilityPage />
                </RequirePermission>
              }
            />
            <Route
              path="guests"
              element={
                <RequirePermission permission="guests.view">
                  <GuestsPage />
                </RequirePermission>
              }
            />
            <Route
              path="rooms"
              element={
                <RequirePermission permission="rooms.view">
                  <>
                    <InventoryTabs />
                    <Outlet />
                  </>
                </RequirePermission>
              }
            >
              <Route
                index
                element={
                  <RequirePermission permission="rooms.view">
                    <RoomsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="types"
                element={
                  <RequirePermission permission="room-types.view">
                    <RoomTypesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="floors"
                element={
                  <RequirePermission permission="floors.view">
                    <FloorsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="rate-plans"
                element={
                  <RequirePermission permission="rate-plans.view">
                    <RatePlansPage />
                  </RequirePermission>
                }
              />
            </Route>
            <Route
              path="folios"
              element={
                <RequirePermission permission="folios.view">
                  <FoliosPage />
                </RequirePermission>
              }
            />
            <Route
              path="folios/:id"
              element={
                <RequirePermission permission="folios.view">
                  <FolioDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="housekeeping"
              element={
                <RequirePermission permission="housekeeping.view">
                  <HousekeepingPage />
                </RequirePermission>
              }
            />
            <Route
              path="maintenance"
              element={
                <RequirePermission permission="maintenance.view">
                  <MaintenancePage />
                </RequirePermission>
              }
            />
            <Route
              path="services"
              element={
                <RequirePermission permission="services.view">
                  <ServicesPage />
                </RequirePermission>
              }
            />
            <Route
              path="reports"
              element={
                <RequirePermission permission="reports.view">
                  <ReportsPage />
                </RequirePermission>
              }
            />
            <Route path="settings" element={<ModuleRoute name="Settings" />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
