import { useState, useEffect } from 'react';
import { getAdminStats } from '../api';

function Developer() {
    const [exporting, setExporting] = useState(false);
    const [stats, setStats] = useState(null);

    const [error, setError] = useState(null);

    useEffect(() => {
        loadStats();
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

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Developer Tools</h1>
                    <p className="page-subtitle">Advanced administration and debugging tools.</p>
                </div>
            </div>

            <div className="grid grid-2">
                <div className="card">
                    <h3 className="section-title">Database Stats</h3>
                    {error ? (
                        <div className="text-negative">{error}</div>
                    ) : stats ? (
                        <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <div>
                                <div className="text-muted">Database Size</div>
                                <div className="stat-value" style={{ fontSize: '1.5rem' }}>{formatBytes(stats.sizeBytes)}</div>
                            </div>
                            <div>
                                <div className="text-muted">Accounts</div>
                                <div className="stat-value" style={{ fontSize: '1.5rem' }}>{stats.accounts}</div>
                            </div>
                            <div>
                                <div className="text-muted">Holdings</div>
                                <div className="stat-value" style={{ fontSize: '1.5rem' }}>{stats.holdings}</div>
                            </div>
                            <div>
                                <div className="text-muted">Transactions</div>
                                <div className="stat-value" style={{ fontSize: '1.5rem' }}>{stats.transactions}</div>
                            </div>
                            <div>
                                <div className="text-muted">Cached Prices</div>
                                <div className="stat-value" style={{ fontSize: '1.5rem' }}>{stats.prices}</div>
                            </div>
                            <div>
                                <div className="text-muted">Dividends</div>
                                <div className="stat-value" style={{ fontSize: '1.5rem' }}>{stats.dividends}</div>
                            </div>
                        </div>
                    ) : (
                        <div className="loading"><div className="spinner"></div></div>
                    )}
                </div>

                <div className="card">
                    <h3 className="section-title">Database Management</h3>
                    <p className="text-muted" style={{ marginBottom: '1rem' }}>
                        Download a copy of the SQLite database (`giraffe.db`) for backup or inspection.
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={handleExportDB}
                        disabled={exporting}
                    >
                        {exporting ? 'Exporting...' : '⬇ Export Database'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Developer;
