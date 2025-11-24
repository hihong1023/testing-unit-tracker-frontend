// src/App.tsx
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useNavigate,
} from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import UnitsPage from "./pages/UnitsPage";
import UnitDetailPage from "./pages/UnitDetailPage";
import TesterQueuePage from "./pages/TesterQueuePage";
import TesterUpcomingPage from "./pages/TesterUpcomingPage";
import UploadResultPage from "./pages/UploadResultPage";
import SchedulerPage from "./pages/SchedulerPage";
import MatrixViewPage from "./pages/MatrixViewPage";

import { getRole, getUser, setToken, setRole, setUser } from "./api";

import "./styles.css";

function App() {
  const role = getRole();
  const user = getUser();
  const navigate = useNavigate();

  const logout = () => {
    setToken(null);
    setRole(null);
    setUser(null);
    navigate("/login");
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    "app-shell__nav-item" +
    (isActive ? " app-shell__nav-item--active" : "");

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="app-shell__sidebar">
        <div className="app-shell__logo">
          <div className="app-shell__logo-mark">AVI</div>
          <span>IDRS Testing Unit Tracker</span>
        </div>

        {role && (
          <>
            <div className="app-shell__nav-section-label">Main</div>
            <nav className="app-shell__nav">
              {/* Always visible */}
              <NavLink to="/units" className={navItemClass}>
                Units
              </NavLink>

              {/* Tester-only menu items */}
              {role === "tester" && (
                <>
                  <NavLink to="/tester" end className={navItemClass}>
                    Today&apos;s Queue
                  </NavLink>

                  <NavLink to="/tester/upcoming" className={navItemClass}>
                    Upcoming Tests
                  </NavLink>
                </>
              )}

              {/* Shared items */}
              <NavLink to="/upload" className={navItemClass}>
                Upload Result
              </NavLink>

              <NavLink to="/matrix" className={navItemClass}>
                Matrix View
              </NavLink>

              {/* Supervisor-only */}
              {role === "supervisor" && (
                <NavLink to="/scheduler" className={navItemClass}>
                  Scheduler
                </NavLink>
              )}
            </nav>
          </>
        )}
      </aside>

      {/* Main area */}
      <main className="app-shell__main">
        {/* Top bar with user info */}
        <header
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginBottom: 16,
            gap: 12,
          }}
        >
          {user && (
            <>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                Signed in as{" "}
                <strong style={{ color: "var(--text-main)" }}>
                  {user.name}
                </strong>
              </span>
              <button className="btn btn-outline" onClick={logout}>
                Logout
              </button>
            </>
          )}
        </header>

        {/* Page content */}
        <div className="page">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/units" element={<UnitsPage />} />
            <Route path="/units/:unitId" element={<UnitDetailPage />} />
            <Route path="/tester" element={<TesterQueuePage />} />
            <Route path="/tester/upcoming" element={<TesterUpcomingPage />} />
            <Route path="/upload" element={<UploadResultPage />} />
            <Route path="/matrix" element={<MatrixViewPage />} />
            <Route path="/scheduler" element={<SchedulerPage />} />
            <Route
              path="*"
              element={
                role ? (
                  <Navigate to="/units" />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
