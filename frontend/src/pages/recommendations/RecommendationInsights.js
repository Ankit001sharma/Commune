import React, { useEffect, useState } from 'react';
import { aiAPI } from '../../services/api';
import ListingCard from '../../components/cards/ListingCard';

const CampaignRow = ({ c }) => {
  const sent = c.sentAt ? new Date(c.sentAt).toLocaleString() : '—';
  const status = c.status || 'unknown';
  const preview = (c.items || []).slice(0, 2).map((i) => i.title).filter(Boolean).join(', ');
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: '1px solid var(--cx-border)',
        marginBottom: 10,
        background: 'var(--cx-bg-elevated)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ textTransform: 'capitalize' }}>{(c.campaignType || '').replace(/-/g, ' ')}</strong>
        <span style={{ fontSize: 13, color: 'var(--cx-text-muted)' }}>{sent}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--cx-text-muted)', marginTop: 6 }}>
        {c.subject}
      </div>
      {preview && (
        <div style={{ fontSize: 13, marginTop: 8 }}>{preview}</div>
      )}
      <div style={{ fontSize: 12, marginTop: 8, color: 'var(--cx-text-muted)' }}>
        Status: {status}
        {c.abArm ? ` · variant ${c.abArm}` : ''}
      </div>
    </div>
  );
};

const RecommendationInsights = () => {
  const [feed, setFeed] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [feedRes, campRes] = await Promise.all([
          aiAPI.getRecommendationFeed({ limit: 8 }),
          aiAPI.getEmailCampaigns(),
        ]);
        if (!cancelled) {
          setFeed(feedRes.data.data);
          setCampaigns(campRes.data.data?.campaigns || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: 280 }}>
        <div className="spinner" />
      </div>
    );
  }

  const summary = feed?.profileSummary;

  return (
    <div className="page-container">
      <h1 className="section-title" style={{ marginBottom: 8 }}>AI recommendations</h1>
      <p style={{ color: 'var(--cx-text-muted)', marginBottom: 28, maxWidth: 720, lineHeight: 1.5 }}>
        This dashboard reflects signals we learn from your searches, listing views, and saves — the same
        data that powers personalized emails and your Home feed.
      </p>

      {summary && (
        <section style={{ marginBottom: 36 }}>
          <h2 className="section-title" style={{ fontSize: '1.15rem' }}>Your signals</h2>
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              border: '1px solid var(--cx-border)',
              background: 'var(--cx-bg-elevated)',
              marginTop: 12,
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <strong>Top category:</strong>{' '}
              {summary.topCategory || 'Not enough views yet'}
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>Frequent keywords:</strong>{' '}
              {(summary.topKeywords || []).map((k) => k.keyword).filter(Boolean).join(', ') || '—'}
            </div>
            {(summary.unmetSearches || []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <strong>Searches with no results (we watch these for new listings):</strong>
                <ul style={{ margin: '8px 0 0 18px' }}>
                  {summary.unmetSearches.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {feed?.personalizedListings?.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <h2 className="section-title" style={{ fontSize: '1.15rem' }}>Top picks for you</h2>
          <div className="card-grid" style={{ marginTop: 16 }}>
            {feed.personalizedListings.map((item) => (
              <ListingCard key={item._id} listing={item} />
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 36 }}>
        <h2 className="section-title" style={{ fontSize: '1.15rem' }}>Recent recommendation emails</h2>
        <p style={{ fontSize: 14, color: 'var(--cx-text-muted)', marginBottom: 12 }}>
          Audit trail of AI-generated campaigns sent to your inbox (subject lines match what was delivered).
        </p>
        {campaigns.length === 0 ? (
          <p style={{ color: 'var(--cx-text-muted)' }}>No campaigns logged yet.</p>
        ) : (
          campaigns.map((c) => <CampaignRow key={c._id} c={c} />)
        )}
      </section>
    </div>
  );
};

export default RecommendationInsights;
