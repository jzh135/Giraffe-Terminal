import { useState, useEffect } from 'react';
import { getAdminStats, resetDatabase, restartServer, getAppSettings, updateAppSettings } from '../api';
import './Developer.css';

function Developer() {
    const [exporting, setExporting] = useState(false);
    const [stats, setStats] = useState(null);
    const [confirmReset, setConfirmReset] = useState(false);
    const [resetInput, setResetInput] = useState('');
    const [resetting, setResetting] = useState(false);
    const [restarting, setRestarting] = useState(false);

    // Branding state
    const [appSettings, setAppSettings] = useState(null);
    const [editingBrand, setEditingBrand] = useState(false);
    const [appName, setAppName] = useState('');
    const [logoType, setLogoType] = useState('default');
    const [logoValue, setLogoValue] = useState('🦒');
    const [savingBrand, setSavingBrand] = useState(false);

    const [error, setError] = useState(null);

    const defaultEmojis = ['🦒', '📈', '💰', '🚀', '💎', '🏆', '⭐', '🎯'];

    useEffect(() => {
        loadStats();
        loadSettings();
    }, []);

    async function loadStats() {
        try {
            setError(null);
            const data = await getAdminStats();
            setStats(data);
        } catch (err) {
            console.error('Failed to load stats:', err);
            setError('Failed to load database statistics. Ensure server is running.');
        }
    }

    async function loadSettings() {
        try {
            const settings = await getAppSettings();
            setAppSettings(settings);
            setAppName(settings.app_name || 'Giraffe Terminal');
            setLogoType(settings.logo_type || 'default');
            setLogoValue(settings.logo_value || '🦒');
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    }

    const handleSaveBranding = async () => {
        setSavingBrand(true);
        try {
            const newSettings = await updateAppSettings({
                app_name: appName,
                logo_type: logoType,
                logo_value: logoValue
            });
            setAppSettings(newSettings);
            setEditingBrand(false);
            // Reload page to show updated branding
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert('Failed to update branding: ' + err.message);
        } finally {
            setSavingBrand(false);
        }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            setLogoType('upload');
            setLogoValue(event.target.result);
        };
        reader.readAsDataURL(file);
    };

    const handleCancelBranding = () => {
        setEditingBrand(false);
        setAppName(appSettings?.app_name || 'Giraffe Terminal');
        setLogoType(appSettings?.logo_type || 'default');
        setLogoValue(appSettings?.logo_value || '🦒');
    };

    const handleExportDB = async () => {
        setExporting(true);
        try {
            const response = await fetch('/api/admin/export-db');
            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `giraffe_backup_${new Date().toISOString().split('T')[0]}.db`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error(err);
            alert('Failed to export database');
        } finally {
            setExporting(false);
        }
    };

    const handleResetDB = async () => {
        if (resetInput !== 'confirm') return;

        setResetting(true);
        try {
            await resetDatabase();
            alert('Database reset successfully. Reloading...');
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert('Failed to reset database: ' + err.message);
        } finally {
            setResetting(false);
        }
    };

    const handleRestartServer = async () => {
        setRestarting(true);
        try {
            await restartServer();
            alert('Server is restarting... The page will reload automatically.');
            // Wait a bit for server to restart, then reload
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (err) {
            console.error(err);
            alert('Failed to restart server. It may already be restarting.');
            // Still try to reload after a delay
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        }
        // Note: we don't set restarting to false because the page will reload
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const StatCard = ({ icon, label, value, gradient, onClick }) => (
        <div
            className={`dev-stat-card ${onClick ? 'clickable' : ''}`}
            style={{ '--gradient': gradient }}
            onClick={onClick}
        >
            <div className="dev-stat-icon">{icon}</div>
            <div className="dev-stat-content">
                <div className="dev-stat-label">{label}</div>
                <div className="dev-stat-value">{value}</div>
            </div>
            <div className="dev-stat-glow"></div>
        </div>
    );

    return (
        <div className="developer-page">
            <div className="dev-header">
                <div className="dev-header-content">
                    <div className="dev-header-badge">
                        <span className="dev-badge-icon">⚡</span>
                        <span>Developer</span>
                    </div>
                    <h1 className="dev-title">System Control Center</h1>
                    <p className="dev-subtitle">Advanced administration, debugging, and system metrics</p>
                </div>
                <div className="dev-header-decoration">
                    <div className="dev-orb dev-orb-1"></div>
                    <div className="dev-orb dev-orb-2"></div>
                    <div className="dev-orb dev-orb-3"></div>
                </div>
            </div>

            <div className="dev-section">
                <div className="dev-section-header">
                    <h2 className="dev-section-title">
                        <span className="dev-section-icon">🎨</span>
                        App Branding
                    </h2>
                    {!editingBrand && (
                        <button className="dev-refresh-btn" onClick={() => setEditingBrand(true)}>
                            <span className="dev-refresh-icon">✏️</span>
                            Edit
                        </button>
                    )}
                </div>

                {appSettings && (
                    <div className="dev-branding-card">
                        <div className="dev-branding-preview">
                            <div className="dev-branding-logo">
                                {editingBrand ? (
                                    logoType === 'upload' && logoValue.startsWith('data:') ? (
                                        <img src={logoValue} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <span style={{ fontSize: '3rem' }}>{logoValue}</span>
                                    )
                                ) : (
                                    appSettings.logo_type === 'upload' && appSettings.logo_value.startsWith('data:') ? (
                                        <img src={appSettings.logo_value} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <span style={{ fontSize: '3rem' }}>{appSettings.logo_value}</span>
                                    )
                                )}
                            </div>
                            <div className="dev-branding-name">
                                {editingBrand ? appName : appSettings.app_name}
                            </div>
                        </div>

                        {editingBrand && (
                            <div className="dev-branding-editor">
                                <div className="form-group">
                                    <label className="form-label">Application Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={appName}
                                        onChange={(e) => setAppName(e.target.value)}
                                        placeholder="Enter app name"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Logo Type</label>
                                    <div className="dev-logo-type-selector">
                                        <button
                                            className={`dev-logo-type-btn ${logoType === 'default' ? 'active' : ''}`}
                                            onClick={() => setLogoType('default')}
                                        >
                                            Emoji
                                        </button>
                                        <button
                                            className={`dev-logo-type-btn ${logoType === 'custom' ? 'active' : ''}`}
                                            onClick={() => setLogoType('custom')}
                                        >
                                            Custom
                                        </button>
                                        <label className={`dev-logo-type-btn ${logoType === 'upload' ? 'active' : ''}`}>
                                            Upload
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleLogoUpload}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                    </div>
                                </div>

                                {logoType === 'default' && (
                                    <div className="form-group">
                                        <label className="form-label">Select Emoji</label>
                                        <div className="dev-emoji-grid">
                                            {defaultEmojis.map(emoji => (
                                                <button
                                                    key={emoji}
                                                    className={`dev-emoji-btn ${logoValue === emoji ? 'active' : ''}`}
                                                    onClick={() => setLogoValue(emoji)}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {logoType === 'custom' && (
                                    <div className="form-group">
                                        <label className="form-label">Custom Emoji/Text</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={logoValue}
                                            onChange={(e) => setLogoValue(e.target.value)}
                                            placeholder="Enter emoji or text (e.g., 🦒 or GT)"
                                            maxLength="5"
                                        />
                                    </div>
                                )}

                                {logoType === 'upload' && logoValue.startsWith('data:') && (
                                    <div className="dev-upload-info">
                                        <span className="dev-success-icon">✓</span>
                                        Image uploaded successfully
                                    </div>
                                )}

                                <div className="dev-branding-actions">
                                    <button
                                        className="btn btn-secondary"
                                        onClick={handleCancelBranding}
                                        disabled={savingBrand}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSaveBranding}
                                        disabled={savingBrand || !appName.trim()}
                                    >
                                        {savingBrand ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="dev-section">
                <div className="dev-section-header">
                    <h2 className="dev-section-title">
                        <span className="dev-section-icon">📊</span>
                        System Overview
                    </h2>
                    <button className="dev-refresh-btn" onClick={loadStats}>
                        <span className="dev-refresh-icon">↻</span>
                        Refresh
                    </button>
                </div>

                {error ? (
                    <div className="dev-error">
                        <span className="dev-error-icon">⚠️</span>
                        {error}
                    </div>
                ) : stats ? (
                    <div className="dev-stats-grid">
                        <StatCard
                            icon="💾"
                            label="Database Size"
                            value={formatBytes(stats.sizeBytes)}
                            gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        />
                        <StatCard
                            icon="👥"
                            label="Accounts"
                            value={stats.accounts}
                            gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
                        />
                        <StatCard
                            icon="📈"
                            label="Active Holdings"
                            value={stats.holdings}
                            gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
                        />
                        <StatCard
                            icon="🤝"
                            label="Transactions"
                            value={stats.transactions}
                            gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
                        />
                        <StatCard
                            icon="💰"
                            label="Dividends"
                            value={stats.dividends}
                            gradient="linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
                        />
                        <StatCard
                            icon="🏷️"
                            label="Stocks"
                            value={stats.prices}
                            gradient="linear-gradient(135deg, #30cfd0 0%, #330867 100%)"
                        />
                    </div>
                ) : (
                    <div className="dev-loading">
                        <div className="dev-spinner"></div>
                        <p>Loading statistics...</p>
                    </div>
                )}
            </div>

            <div className="dev-actions-grid">
                <div className="dev-action-card dev-export-card">
                    <div className="dev-action-header">
                        <div className="dev-action-icon-wrapper" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                            <span className="dev-action-icon">⬇</span>
                        </div>
                        <h3 className="dev-action-title">Export Database</h3>
                    </div>
                    <p className="dev-action-description">
                        Download a complete snapshot of your SQLite database including all accounts, transactions, and configuration data.
                    </p>

                    <button
                        className="dev-action-btn dev-export-btn"
                        onClick={handleExportDB}
                        disabled={exporting}
                    >
                        {exporting ? (
                            <>
                                <span className="dev-btn-spinner"></span>
                                Exporting...
                            </>
                        ) : (
                            <>
                                <span className="dev-btn-icon">⬇</span>
                                Export Database
                            </>
                        )}
                    </button>
                </div>

                <div className="dev-action-card dev-restart-card">
                    <div className="dev-action-header">
                        <div className="dev-action-icon-wrapper" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                            <span className="dev-action-icon dev-restart-icon">🔄</span>
                        </div>
                        <h3 className="dev-action-title">Restart Server</h3>
                    </div>
                    <p className="dev-action-description">
                        Trigger a server restart. Useful after configuration changes or when debugging persistent issues.
                    </p>

                    <button
                        className="dev-action-btn dev-restart-btn"
                        onClick={handleRestartServer}
                        disabled={restarting}
                    >
                        {restarting ? (
                            <>
                                <span className="dev-btn-spinner"></span>
                                Restarting...
                            </>
                        ) : (
                            <>
                                <span className="dev-btn-icon">🔄</span>
                                Restart Server
                            </>
                        )}
                    </button>
                </div>

                <div className="dev-action-card dev-danger-card">
                    <div className="dev-action-header">
                        <div className="dev-action-icon-wrapper dev-danger-icon-wrapper">
                            <span className="dev-action-icon">☢️</span>
                        </div>
                        <h3 className="dev-action-title dev-danger-title">Danger Zone</h3>
                    </div>
                    <p className="dev-action-description">
                        Critical operations that permanently delete data. This action cannot be undone.
                    </p>

                    {!confirmReset ? (
                        <button
                            className="dev-action-btn dev-danger-btn"
                            onClick={() => setConfirmReset(true)}
                        >
                            <span className="dev-btn-icon">🗑️</span>
                            Factory Reset
                        </button>
                    ) : (
                        <div className="dev-confirm-section">
                            <div className="dev-confirm-warning">
                                <span className="dev-warning-icon">⚠️</span>
                                <p>Type <code className="dev-confirm-code">confirm</code> to proceed:</p>
                            </div>
                            <div className="dev-confirm-actions">
                                <input
                                    type="text"
                                    className="dev-confirm-input"
                                    placeholder="Type confirm"
                                    value={resetInput}
                                    onChange={(e) => setResetInput(e.target.value)}
                                    autoFocus
                                />
                                <button
                                    className="dev-confirm-btn"
                                    disabled={resetInput !== 'confirm' || resetting}
                                    onClick={handleResetDB}
                                >
                                    {resetting ? '...' : 'Reset'}
                                </button>
                                <button
                                    className="dev-cancel-btn"
                                    onClick={() => {
                                        setConfirmReset(false);
                                        setResetInput('');
                                    }}
                                    disabled={resetting}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Developer;
