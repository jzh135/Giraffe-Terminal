import { Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getAppSettings } from './api';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import AccountDetail from './pages/AccountDetail';
import Holdings from './pages/Holdings';
import StockDetail from './pages/StockDetail';
import Research from './pages/Research';
import Activity from './pages/Activity';
import Performance from './pages/Performance';
import Developer from './pages/Developer';

function App() {
    const [appSettings, setAppSettings] = useState(null);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        try {
            const settings = await getAppSettings();
            setAppSettings(settings);
        } catch (err) {
            console.error('Failed to load app settings:', err);
            // Use defaults if fetch fails
            setAppSettings({
                app_name: 'Giraffe Terminal',
                logo_type: 'default',
                logo_value: '🦒'
            });
        }
    }

    const renderLogo = () => {
        if (!appSettings) return '🦒';

        if (appSettings.logo_type === 'upload' && appSettings.logo_value?.startsWith('data:')) {
            return <img src={appSettings.logo_value} alt="Logo" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />;
        }
        return appSettings.logo_value || '🦒';
    };

    const appName = appSettings?.app_name || 'Giraffe Terminal';

    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    {renderLogo()} <span>{appName}</span>
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
                    <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #333' }}>
                        <NavLink to="/developer" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            🛠️ Developer
                        </NavLink>
                    </div>
                </nav>
            </aside>

            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/accounts" element={<Accounts />} />
                    <Route path="/accounts/:id" element={<AccountDetail />} />
                    <Route path="/holdings" element={<Holdings />} />
                    <Route path="/holdings/:symbol" element={<StockDetail />} />
                    <Route path="/holdings/:symbol/research" element={<Research />} />
                    <Route path="/activity" element={<Activity />} />
                    <Route path="/performance" element={<Performance />} />
                    <Route path="/developer" element={<Developer />} />
                </Routes>
            </main>
        </div>
    );
}

export default App;
