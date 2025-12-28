import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../api';

const MAX_NOTES_LENGTH = 1000;

// StarRating component - defined outside to prevent re-creation
const StarRating = ({ value, onChange }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const filled = value >= i;
    const halfFilled = value >= i - 0.5 && value < i;
    stars.push(
      <span
        key={i}
        onClick={() => onChange && onChange(value === i ? i - 0.5 : value === i - 0.5 ? null : i)}
        style={{
          cursor: 'pointer',
          fontSize: '1.5rem',
          color: filled || halfFilled ? '#f59e0b' : '#d1d5db',
          transition: 'transform 0.1s ease',
        }}
        title={`Click for ${i} stars`}
        onMouseEnter={(e) => (e.target.style.transform = 'scale(1.2)')}
        onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
      >
        {filled ? '★' : halfFilled ? '⯨' : '☆'}
      </span>
    );
  }
  return <span style={{ display: 'inline-flex', gap: '4px' }}>{stars}</span>;
};

// Rating Card Component - defined outside to prevent re-creation
const RatingCard = ({ title, ratingKey, notesKey, icon, form, setForm }) => (
  <div className="card" style={{ marginBottom: '16px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
      <span style={{ fontSize: '1.5rem' }}>{icon}</span>
      <h3 style={{ margin: 0 }}>{title}</h3>
    </div>

    <div style={{ marginBottom: '16px' }}>
      <label className="form-label">Rating</label>
      <div style={{ padding: '8px 0' }}>
        <StarRating
          value={form[ratingKey]}
          onChange={(v) => setForm((prev) => ({ ...prev, [ratingKey]: v }))}
        />
        <span style={{ marginLeft: '12px', color: '#9ca3af', fontSize: '0.9rem' }}>
          {form[ratingKey] ? `${form[ratingKey]} / 5` : 'Not rated'}
        </span>
      </div>
    </div>

    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="form-label">Notes</label>
        <span
          style={{
            fontSize: '0.8rem',
            color: (form[notesKey]?.length || 0) > MAX_NOTES_LENGTH * 0.9 ? '#f59e0b' : '#6b7280',
            fontWeight: (form[notesKey]?.length || 0) >= MAX_NOTES_LENGTH ? 'bold' : 'normal',
          }}
        >
          {MAX_NOTES_LENGTH - (form[notesKey]?.length || 0)} characters remaining
        </span>
      </div>
      <textarea
        className="form-input"
        value={form[notesKey]}
        onChange={(e) => setForm((prev) => ({ ...prev, [notesKey]: e.target.value }))}
        placeholder={`Add your ${title.toLowerCase()} analysis notes here...`}
        rows={4}
        maxLength={MAX_NOTES_LENGTH}
        style={{ resize: 'vertical', minHeight: '100px' }}
      />
    </div>
  </div>
);

function Research() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const [price, setPrice] = useState(null);
  const [roles, setRoles] = useState([]);
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    theme_id: null,
    role_id: null,
    overall_rating: null,
    valuation_rating: null,
    growth_quality_rating: null,
    econ_moat_rating: null,
    leadership_rating: null,
    financial_health_rating: null,
    overall_notes: '',
    valuation_notes: '',
    growth_quality_notes: '',
    econ_moat_notes: '',
    leadership_notes: '',
    financial_health_notes: '',
    target_median_price: null,
    buy_target_price: null,
    sell_target_price: null,
  });

  useEffect(() => {
    loadData();
  }, [symbol]);

  async function loadData() {
    try {
      const [priceData, rolesData, themesData] = await Promise.all([
        api.fetchPrice(symbol),
        api.getRoles(),
        api.getThemes(),
      ]);

      setPrice(priceData);
      setRoles(rolesData || []);
      setThemes(themesData || []);

      // Initialize form with existing data
      setForm({
        theme_id: priceData?.theme_id ?? null,
        role_id: priceData?.role_id ?? null,
        overall_rating: priceData?.overall_rating ?? null,
        valuation_rating: priceData?.valuation_rating ?? null,
        growth_quality_rating: priceData?.growth_quality_rating ?? null,
        econ_moat_rating: priceData?.econ_moat_rating ?? null,
        leadership_rating: priceData?.leadership_rating ?? null,
        financial_health_rating: priceData?.financial_health_rating ?? null,
        overall_notes: priceData?.overall_notes || '',
        valuation_notes: priceData?.valuation_notes || '',
        growth_quality_notes: priceData?.growth_quality_notes || '',
        econ_moat_notes: priceData?.econ_moat_notes || '',
        leadership_notes: priceData?.leadership_notes || '',
        financial_health_notes: priceData?.financial_health_notes || '',
        target_median_price: priceData?.target_median_price ?? null,
        buy_target_price: priceData?.buy_target_price ?? null,
        sell_target_price: priceData?.sell_target_price ?? null,
      });
    } catch (err) {
      console.error('Failed to load research data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateStockResearch(symbol, form);
      navigate(`/holdings/${symbol}`);
    } catch (err) {
      alert('Failed to save research: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    // Get theme and role names
    const themeName = themes.find((t) => t.id === form.theme_id)?.name || null;
    const roleName = roles.find((r) => r.id === form.role_id)?.name || null;

    // Create export object with all research data
    const exportData = {
      symbol: symbol,
      name: price?.name || symbol,
      exported_at: new Date().toISOString(),
      classification: {
        theme: themeName,
        role: roleName,
      },
      ratings: {
        overall: {
          rating: form.overall_rating,
          notes: form.overall_notes,
        },
        valuation: {
          rating: form.valuation_rating,
          notes: form.valuation_notes,
        },
        growth_quality: {
          rating: form.growth_quality_rating,
          notes: form.growth_quality_notes,
        },
        economic_moat: {
          rating: form.econ_moat_rating,
          notes: form.econ_moat_notes,
        },
        leadership: {
          rating: form.leadership_rating,
          notes: form.leadership_notes,
        },
        financial_health: {
          rating: form.financial_health_rating,
          notes: form.financial_health_notes,
        },
      },
      last_updated: price?.research_updated_at || null,
    };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${symbol}_research_${timestamp}.json`;

    // Create and download file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <button onClick={() => navigate(`/holdings/${symbol}`)} className="btn btn-text">
            ← Back to {symbol}
          </button>
          <h1 className="page-title" style={{ marginTop: '0.5rem' }}>
            📊 Research: {symbol}
            <span
              className="text-muted"
              style={{ fontSize: '1rem', fontWeight: 'normal', marginLeft: '12px' }}
            >
              {price?.name}
            </span>
          </h1>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={handleExport}>
            📥 Export
          </button>
          <button className="btn btn-secondary" onClick={() => navigate(`/holdings/${symbol}`)}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save Research'}
          </button>
        </div>
      </div>

      {/* Classification Section */}
      <div className="card mb-lg">
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>📁 Classification</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '16px',
          }}
        >
          <div>
            <label className="form-label">Theme</label>
            <select
              className="form-input"
              value={form.theme_id || ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  theme_id: e.target.value ? parseInt(e.target.value) : null,
                }))
              }
            >
              <option value="">— Select Theme —</option>
              {themes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Role</label>
            <select
              className="form-input"
              value={form.role_id || ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  role_id: e.target.value ? parseInt(e.target.value) : null,
                }))
              }
            >
              <option value="">— Select Role —</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Price Targets Section */}
      <div className="card mb-lg">
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>🎯 Price Targets</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          <div>
            <label className="form-label">Median Target Price ($)</label>
            <input
              type="number"
              className="form-input"
              value={form.target_median_price || ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  target_median_price: e.target.value ? parseFloat(e.target.value) : null,
                }))
              }
              placeholder="e.g. 185.50"
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <label className="form-label">Buy Target Price ($)</label>
            <input
              type="number"
              className="form-input"
              value={form.buy_target_price || ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  buy_target_price: e.target.value ? parseFloat(e.target.value) : null,
                }))
              }
              placeholder="e.g. 150.00"
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <label className="form-label">Sell Target Price ($)</label>
            <input
              type="number"
              className="form-input"
              value={form.sell_target_price || ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  sell_target_price: e.target.value ? parseFloat(e.target.value) : null,
                }))
              }
              placeholder="e.g. 200.00"
              step="0.01"
              min="0"
            />
          </div>
        </div>
        <p className="text-muted" style={{ marginTop: '12px', fontSize: '0.85rem' }}>
          Set your target prices for buy/sell decisions. Leave blank if not applicable.
        </p>
      </div>

      {/* Overall Rating - Featured */}
      <div
        className="card mb-lg"
        style={{
          background:
            'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{ fontSize: '2rem' }}>⭐</span>
          <h2 style={{ margin: 0 }}>Overall Rating</h2>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ padding: '8px 0' }}>
            <StarRating
              value={form.overall_rating}
              onChange={(v) => setForm((prev) => ({ ...prev, overall_rating: v }))}
            />
            <span style={{ marginLeft: '12px', color: '#9ca3af', fontSize: '0.9rem' }}>
              {form.overall_rating ? `${form.overall_rating} / 5` : 'Not rated'}
            </span>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label">Investment Thesis</label>
            <span
              style={{
                fontSize: '0.8rem',
                color:
                  (form.overall_notes?.length || 0) > MAX_NOTES_LENGTH * 0.9
                    ? '#f59e0b'
                    : '#6b7280',
                fontWeight:
                  (form.overall_notes?.length || 0) >= MAX_NOTES_LENGTH ? 'bold' : 'normal',
              }}
            >
              {MAX_NOTES_LENGTH - (form.overall_notes?.length || 0)} characters remaining
            </span>
          </div>
          <textarea
            className="form-input"
            value={form.overall_notes}
            onChange={(e) => setForm((prev) => ({ ...prev, overall_notes: e.target.value }))}
            placeholder="Summarize your investment thesis and key reasons for holding this stock..."
            rows={5}
            maxLength={MAX_NOTES_LENGTH}
            style={{ resize: 'vertical', minHeight: '120px' }}
          />
        </div>
      </div>

      {/* Individual Ratings Grid */}
      <h3 className="section-title">Detailed Analysis</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: '16px',
        }}
      >
        <RatingCard
          title="Valuation"
          ratingKey="valuation_rating"
          notesKey="valuation_notes"
          icon="💰"
          form={form}
          setForm={setForm}
        />
        <RatingCard
          title="Growth Quality"
          ratingKey="growth_quality_rating"
          notesKey="growth_quality_notes"
          icon="📈"
          form={form}
          setForm={setForm}
        />
        <RatingCard
          title="Economic Moat"
          ratingKey="econ_moat_rating"
          notesKey="econ_moat_notes"
          icon="🏰"
          form={form}
          setForm={setForm}
        />
        <RatingCard
          title="Leadership"
          ratingKey="leadership_rating"
          notesKey="leadership_notes"
          icon="👔"
          form={form}
          setForm={setForm}
        />
        <RatingCard
          title="Financial Health"
          ratingKey="financial_health_rating"
          notesKey="financial_health_notes"
          icon="🏥"
          form={form}
          setForm={setForm}
        />
      </div>

      {/* Last Updated */}
      {price?.research_updated_at && (
        <p className="text-muted" style={{ marginTop: '24px', fontSize: '0.85rem' }}>
          Last updated: {new Date(price.research_updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

export default Research;
