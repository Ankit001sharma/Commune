import React, { useEffect, useState } from 'react';
import { userAPI } from '../../services/api';
import { toast } from '../../components/ui/Toast';

const EmailPreferences = () => {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await userAPI.getEmailPreferences();
        if (!cancelled) setPrefs(data.data || {});
      } catch (e) {
        if (!cancelled) toast.error('Could not load preferences.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = async (payload) => {
    setSaving(true);
    try {
      const { data } = await userAPI.updateEmailPreferences(payload);
      setPrefs(data.data || {});
      toast.success(data.message || 'Saved.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key) => {
    if (!prefs) return;
    patch({ [key]: !prefs[key] });
  };

  if (loading || !prefs) {
    return (
      <div className="loading-container" style={{ minHeight: 240 }}>
        <div className="spinner" />
      </div>
    );
  }

  const unsubscribed = Boolean(prefs.unsubscribedAt);

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <h1 className="section-title" style={{ marginBottom: 8 }}>Email alerts</h1>
      <p style={{ color: 'var(--cx-text-muted)', marginBottom: 28, lineHeight: 1.5 }}>
        Control AI-powered recommendation emails from CommuneX. You can opt out anytime;
        your weekly cap limits how many automated emails we send across all campaigns.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--cx-border)',
            background: 'var(--cx-bg-elevated)',
            cursor: saving ? 'wait' : 'pointer',
            opacity: unsubscribed ? 0.55 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={!!prefs.dailyDigest}
            disabled={saving || unsubscribed}
            onChange={() => toggle('dailyDigest')}
          />
          <div>
            <div style={{ fontWeight: 600 }}>Daily digest</div>
            <div style={{ fontSize: 14, color: 'var(--cx-text-muted)', marginTop: 4 }}>
              Personalized picks based on your searches, views, and saves.
            </div>
          </div>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--cx-border)',
            background: 'var(--cx-bg-elevated)',
            cursor: saving ? 'wait' : 'pointer',
            opacity: unsubscribed ? 0.55 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={!!prefs.newMatchAlerts}
            disabled={saving || unsubscribed}
            onChange={() => toggle('newMatchAlerts')}
          />
          <div>
            <div style={{ fontWeight: 600 }}>New listing alerts</div>
            <div style={{ fontSize: 14, color: 'var(--cx-text-muted)', marginTop: 4 }}>
              When a new item matches something you searched for or categories you browse.
            </div>
          </div>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--cx-border)',
            background: 'var(--cx-bg-elevated)',
            cursor: saving ? 'wait' : 'pointer',
            opacity: unsubscribed ? 0.55 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={!!prefs.reEngagement}
            disabled={saving || unsubscribed}
            onChange={() => toggle('reEngagement')}
          />
          <div>
            <div style={{ fontWeight: 600 }}>We miss you</div>
            <div style={{ fontSize: 14, color: 'var(--cx-text-muted)', marginTop: 4 }}>
              Occasional nudge if you have not visited in a while (weekly at most).
            </div>
          </div>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--cx-border)',
            background: 'var(--cx-bg-elevated)',
            cursor: saving ? 'wait' : 'pointer',
            opacity: unsubscribed ? 0.55 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={prefs.priceDropAlerts !== false}
            disabled={saving || unsubscribed}
            onChange={() => toggle('priceDropAlerts')}
          />
          <div>
            <div style={{ fontWeight: 600 }}>Price drops (coming soon)</div>
            <div style={{ fontSize: 14, color: 'var(--cx-text-muted)', marginTop: 4 }}>
              Reserved for when we track viewed listing prices server-side.
            </div>
          </div>
        </label>

        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--cx-border)',
            background: 'var(--cx-bg-elevated)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Weekly email cap</div>
          <p style={{ fontSize: 14, color: 'var(--cx-text-muted)', marginBottom: 12 }}>
            Maximum recommendation emails per week (all types combined). Set to 0 to mute.
          </p>
          <select
            value={prefs.weeklyCap ?? 4}
            disabled={saving || unsubscribed}
            onChange={(e) => patch({ weeklyCap: parseInt(e.target.value, 10) })}
            style={{ padding: '8px 12px', borderRadius: 8, minWidth: 120 }}
          >
            {[0, 1, 2, 3, 4, 6, 8, 10].map((n) => (
              <option key={n} value={n}>{n} per week</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {unsubscribed ? (
            <button className="btn btn-primary" disabled={saving} onClick={() => patch({ resubscribe: true })}>
              Resubscribe to emails
            </button>
          ) : (
            <button className="btn btn-ghost" disabled={saving} onClick={() => patch({ unsubscribe: true })}>
              Unsubscribe from all recommendation emails
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailPreferences;
