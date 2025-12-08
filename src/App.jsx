import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import AccountDetail from './pages/AccountDetail';
import Holdings from './pages/Holdings';
import StockDetail from './pages/StockDetail';
import Activity from './pages/Activity';
import Performance from './pages/Performance';

function App() {
    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    🦒 <span>Giraffe Terminal</span>
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        📊 Dashboard
                    </NavLink>
                    <NavLink to="/accounts" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        🏦 Accounts
                    </NavLink>
                    <NavLink to="/holdings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        📈 Holdings
                    </NavLink>
                    <NavLink to="/activity" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        📋 Activity
                    </NavLink>
                    <NavLink to="/performance" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        🎯 Performance
                    </NavLink>
                </nav>
            </aside>

            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/accounts" element={<Accounts />} />
                    <Route path="/accounts/:id" element={<AccountDetail />} />
                    <Route path="/holdings" element={<Holdings />} />
                    <Route path="/holdings/:symbol" element={<StockDetail />} />
                    <Route path="/activity" element={<Activity />} />
                    <Route path="/performance" element={<Performance />} />
                </Routes>
            </main>
        </div>
    );
}

export default App;
