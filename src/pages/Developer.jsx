import { useState, useEffect } from 'react';
import {
  getAdminStats,
  resetDatabase,
  restartServer,
  getAppSettings,
  updateAppSettings,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getThemes,
  createTheme,
  updateTheme,
  deleteTheme,
} from '../api';
import './Developer.css';

function Developer() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
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

  // Roles state
  const [roles, setRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#4f46e5');
  const [addingRole, setAddingRole] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

  // Themes state
  const [themes, setThemes] = useState([]);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeColor, setNewThemeColor] = useState('#3b82f6');
  const [addingTheme, setAddingTheme] = useState(false);
  const [editingTheme, setEditingTheme] = useState(null);

  const [error, setError] = useState(null);

  const defaultEmojis = ['🦒', '📈', '💰', '🚀', '💎', '🏆', '⭐', '🎯'];

  useEffect(() => {
    loadStats();
    loadSettings();
    loadRoles();
    loadThemes();
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

  async function loadRoles() {
    try {
      const data = await getRoles();
      setRoles(data || []);
    } catch (err) {
      console.error('Failed to load roles:', err);
    }
  }

  async function loadThemes() {
    try {
      const data = await getThemes();
      setThemes(data || []);
    } catch (err) {
      console.error('Failed to load themes:', err);
    }
  }

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;
    setAddingRole(true);
    try {
      await createRole({ name: newRoleName.trim(), color: newRoleColor });
      setNewRoleName('');
      setNewRoleColor('#4f46e5');
      await loadRoles();
    } catch (err) {
      alert('Failed to add role: ' + err.message);
    } finally {
      setAddingRole(false);
    }
  };

  const handleUpdateRole = async (id, name, color) => {
    try {
      await updateRole(id, { name, color });
      setEditingRole(null);
      await loadRoles();
    } catch (err) {
      alert('Failed to update role: ' + err.message);
    }
  };

  const handleDeleteRole = async (id) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this role? Stocks with this role will have their role cleared.'
      )
    )
      return;
    try {
      await deleteRole(id);
      await loadRoles();
    } catch (err) {
      alert('Failed to delete role: ' + err.message);
    }
  };

  const handleAddTheme = async () => {
    if (!newThemeName.trim()) return;
    setAddingTheme(true);
    try {
      await createTheme({ name: newThemeName.trim(), color: newThemeColor });
      setNewThemeName('');
      setNewThemeColor('#3b82f6');
      await loadThemes();
    } catch (err) {
      alert('Failed to add theme: ' + err.message);
    } finally {
      setAddingTheme(false);
    }
  };

  const handleUpdateTheme = async (id, name, color) => {
    try {
      await updateTheme(id, { name, color });
      setEditingTheme(null);
      await loadThemes();
    } catch (err) {
      alert('Failed to update theme: ' + err.message);
    }
  };

  const handleDeleteTheme = async (id) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this theme? Stocks with this theme will have their theme cleared.'
      )
    )
      return;
    try {
      await deleteTheme(id);
      await loadThemes();
    } catch (err) {
      alert('Failed to delete theme: ' + err.message);
    }
  };

  const handleSaveBranding = async () => {
    setSavingBrand(true);
    try {
      const newSettings = await updateAppSettings({
        app_name: appName,
        logo_type: logoType,
        logo_value: logoValue,
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

  const handleImportDB = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.endsWith('.db')) {
      alert('Please select a valid SQLite database file (.db)');
      return;
    }

    const confirmed = window.confirm(
      'WARNING: This will replace your current database with the uploaded file. ' +
        'All existing data will be overwritten. Are you sure you want to continue?'
    );
    if (!confirmed) {
      e.target.value = ''; // Reset file input
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('database', file);

      const response = await fetch('/api/admin/import-db', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Import failed');
      }

      alert('Database imported successfully! The page will reload.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to import database: ' + err.message);
    } finally {
      setImporting(false);
      e.target.value = ''; // Reset file input
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
                    <img
                      src={logoValue}
                      alt="Logo"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ fontSize: '3rem' }}>{logoValue}</span>
                  )
                ) : appSettings.logo_type === 'upload' &&
                  appSettings.logo_value.startsWith('data:') ? (
                  <img
                    src={appSettings.logo_value}
                    alt="Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ fontSize: '3rem' }}>{appSettings.logo_value}</span>
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
                      {defaultEmojis.map((emoji) => (
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

      {/* Stock Roles & Themes Section */}
      <div className="dev-section">
        <div className="dev-section-header">
          <h2 className="dev-section-title">
            <span className="dev-section-icon">🏷️</span>
            Stock Roles & Themes
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {/* Roles Column */}
          <div className="dev-branding-card">
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 700 }}>
                Roles
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                Categorize stocks by size (e.g., Large Cap, ETF)
              </p>

              {/* Add new role */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="New role name..."
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="color"
                  value={newRoleColor}
                  onChange={(e) => setNewRoleColor(e.target.value)}
                  style={{
                    width: '42px',
                    height: '42px',
                    padding: '2px',
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleAddRole}
                  disabled={addingRole || !newRoleName.trim()}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  {addingRole ? '...' : '+'}
                </button>
              </div>

              {/* Roles list */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}
              >
                {roles.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                    No roles defined yet
                  </div>
                ) : (
                  roles.map((role) => (
                    <div
                      key={role.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: role.color || '#666',
                          flexShrink: 0,
                        }}
                      />
                      {editingRole === role.id ? (
                        <>
                          <input
                            type="text"
                            className="form-input"
                            defaultValue={role.name}
                            id={`edit-role-${role.id}`}
                            style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                          />
                          <input
                            type="color"
                            defaultValue={role.color || '#666'}
                            id={`edit-color-${role.id}`}
                            style={{
                              width: '28px',
                              height: '28px',
                              padding: '1px',
                              cursor: 'pointer',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          />
                          <button
                            className="btn btn-icon"
                            onClick={() => {
                              const name = document.getElementById(`edit-role-${role.id}`).value;
                              const color = document.getElementById(`edit-color-${role.id}`).value;
                              handleUpdateRole(role.id, name, color);
                            }}
                            title="Save"
                            style={{ padding: '0.25rem' }}
                          >
                            ✓
                          </button>
                          <button
                            className="btn btn-icon"
                            onClick={() => setEditingRole(null)}
                            title="Cancel"
                            style={{ padding: '0.25rem' }}
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem' }}>
                            {role.name}
                          </span>
                          <button
                            className="btn btn-icon"
                            onClick={() => setEditingRole(role.id)}
                            title="Edit"
                            style={{ padding: '0.25rem', fontSize: '0.75rem' }}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-icon"
                            onClick={() => handleDeleteRole(role.id)}
                            title="Delete"
                            style={{ padding: '0.25rem', fontSize: '0.75rem' }}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Themes Column */}
          <div className="dev-branding-card">
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 700 }}>
                Themes
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                Categorize stocks by sector (e.g., Technology, Healthcare)
              </p>

              {/* Add new theme */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="New theme name..."
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="color"
                  value={newThemeColor}
                  onChange={(e) => setNewThemeColor(e.target.value)}
                  style={{
                    width: '42px',
                    height: '42px',
                    padding: '2px',
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleAddTheme}
                  disabled={addingTheme || !newThemeName.trim()}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  {addingTheme ? '...' : '+'}
                </button>
              </div>

              {/* Themes list */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}
              >
                {themes.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                    No themes defined yet
                  </div>
                ) : (
                  themes.map((theme) => (
                    <div
                      key={theme.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: theme.color || '#666',
                          flexShrink: 0,
                        }}
                      />
                      {editingTheme === theme.id ? (
                        <>
                          <input
                            type="text"
                            className="form-input"
                            defaultValue={theme.name}
                            id={`edit-theme-${theme.id}`}
                            style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                          />
                          <input
                            type="color"
                            defaultValue={theme.color || '#666'}
                            id={`edit-theme-color-${theme.id}`}
                            style={{
                              width: '28px',
                              height: '28px',
                              padding: '1px',
                              cursor: 'pointer',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          />
                          <button
                            className="btn btn-icon"
                            onClick={() => {
                              const name = document.getElementById(`edit-theme-${theme.id}`).value;
                              const color = document.getElementById(
                                `edit-theme-color-${theme.id}`
                              ).value;
                              handleUpdateTheme(theme.id, name, color);
                            }}
                            title="Save"
                            style={{ padding: '0.25rem' }}
                          >
                            ✓
                          </button>
                          <button
                            className="btn btn-icon"
                            onClick={() => setEditingTheme(null)}
                            title="Cancel"
                            style={{ padding: '0.25rem' }}
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem' }}>
                            {theme.name}
                          </span>
                          <button
                            className="btn btn-icon"
                            onClick={() => setEditingTheme(theme.id)}
                            title="Edit"
                            style={{ padding: '0.25rem', fontSize: '0.75rem' }}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-icon"
                            onClick={() => handleDeleteTheme(theme.id)}
                            title="Delete"
                            style={{ padding: '0.25rem', fontSize: '0.75rem' }}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
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
            <div
              className="dev-action-icon-wrapper"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              <span className="dev-action-icon">⬇</span>
            </div>
            <h3 className="dev-action-title">Export Database</h3>
          </div>
          <p className="dev-action-description">
            Download a complete snapshot of your SQLite database including all accounts,
            transactions, and configuration data.
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

        <div className="dev-action-card dev-import-card">
          <div className="dev-action-header">
            <div
              className="dev-action-icon-wrapper"
              style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}
            >
              <span className="dev-action-icon">⬆</span>
            </div>
            <h3 className="dev-action-title">Import Database</h3>
          </div>
          <p className="dev-action-description">
            Restore from a backup file. This will replace all current data with the uploaded
            database.
          </p>

          <label className={`dev-action-btn dev-import-btn ${importing ? 'disabled' : ''}`}>
            {importing ? (
              <>
                <span className="dev-btn-spinner"></span>
                Importing...
              </>
            ) : (
              <>
                <span className="dev-btn-icon">⬆</span>
                Import Database
              </>
            )}
            <input
              type="file"
              accept=".db"
              onChange={handleImportDB}
              disabled={importing}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <div className="dev-action-card dev-restart-card">
          <div className="dev-action-header">
            <div
              className="dev-action-icon-wrapper"
              style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}
            >
              <span className="dev-action-icon dev-restart-icon">🔄</span>
            </div>
            <h3 className="dev-action-title">Restart Server</h3>
          </div>
          <p className="dev-action-description">
            Trigger a server restart. Useful after configuration changes or when debugging
            persistent issues.
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
            <button className="dev-action-btn dev-danger-btn" onClick={() => setConfirmReset(true)}>
              <span className="dev-btn-icon">🗑️</span>
              Factory Reset
            </button>
          ) : (
            <div className="dev-confirm-section">
              <div className="dev-confirm-warning">
                <span className="dev-warning-icon">⚠️</span>
                <p>
                  Type <code className="dev-confirm-code">confirm</code> to proceed:
                </p>
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
