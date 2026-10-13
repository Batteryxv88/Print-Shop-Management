import { Route, Routes, Navigate } from "react-router-dom";
import { MainPage } from "../pages/MainPage";
import { Suspense } from "react";
import { Navbar } from "../widgets/Navbar";
import Sidebar from "../widgets/Sidebar/ui/Sidebar";
import Favicon from "react-favicon";
import Fvicon from '../../public/favicon.svg'
import { CalculatorPageAsync } from "../pages/CalculatorPage/ui/CalculatorPage.async";
import { AuthForm } from "../components/AuthForm";
import { AuthProvider } from "../contexts/AuthContext";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { RoleBasedRoute } from "../components/RoleBasedRoute";
import { FirebaseDataProvider } from "./providers/FirebaseDataProvider";
import cls from './App.module.scss';
import { RotationPageAsync } from "../pages/RotationPage/ui/RotationPage.async";
import { ManualsPageAsync } from "../pages/ManualsPage/ui/ManualsPage.async";
import { AdminPageAsync } from "../pages/AdminPage/ui/AdminPage.async";
import { AnalyticsPage } from "../pages/AnalyticsPage";
import { JournalPage } from "../pages/JournalPage";

const App = () => {
  return (
    <AuthProvider>
      <div className={cls.app}>
        <Favicon url={Fvicon} />
        <Routes>
          <Route
            path="/login"
            element={<AuthForm />}
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <FirebaseDataProvider>
                  <div className={cls.container}>
                    <Navbar />
                    <div className={cls.content}>
                      <Sidebar />
                      <div className={cls.pages}>
                        <Suspense fallback={<div className={cls.loading}>Loading...</div>}>
                          <Routes>
                            <Route
                              path="/journal"
                              element={
                                <RoleBasedRoute allowedRoles={['администратор', 'руководитель', 'печатник']}>
                                  <JournalPage />
                                </RoleBasedRoute>
                              }
                            />
                            <Route path="/toner" element={<Navigate to="/journal" replace />} />
                            <Route path="/schedule" element={<Navigate to="/journal" replace />} />
                            <Route path="/" element={<MainPage />} />
                            <Route
                              path="/analytics"
                              element={
                                <RoleBasedRoute allowedRoles={['администратор', 'руководитель']}>
                                  <AnalyticsPage />
                                </RoleBasedRoute>
                              }
                            />
                            <Route path="/report" element={<Navigate to="/analytics" replace />} />
                            <Route path="/calculator" element={<CalculatorPageAsync />} />
                            <Route path="/rotation"
                              element={<RoleBasedRoute
                                allowedRoles={['администратор', 'руководитель', 'печатник', 'дизайнер', 'резчик', 'менеджер']}>
                                <RotationPageAsync />
                              </RoleBasedRoute>} />
                            <Route path="/manuals"
                              element={<RoleBasedRoute
                                allowedRoles={['администратор', 'руководитель', 'печатник']}>
                                <ManualsPageAsync />
                              </RoleBasedRoute>} />
                            <Route
                              path="/admin"
                              element={
                                <RoleBasedRoute allowedRoles={['администратор']}>
                                  <AdminPageAsync />
                                </RoleBasedRoute>
                              }
                            />
                          </Routes>
                        </Suspense>
                      </div>
                    </div>
                  </div>
                </FirebaseDataProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </AuthProvider>
  );
};

export default App;
