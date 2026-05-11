import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listingAPI, aiAPI } from "../services/api";
import ListingCard from "../components/cards/ListingCard";

const Section = ({ title, subtitle, actionLabel, onAction, children }) => (
  <section style={{ marginTop: 48 }}>
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "20px",
      flexWrap: "wrap",
      gap: 12,
    }}>
      <div>
        <h2 className="section-title" style={{ marginBottom: subtitle ? 6 : 0 }}>{title}</h2>
        {subtitle && (
          <p style={{ margin: 0, fontSize: 14, color: "var(--cx-text-muted)" }}>{subtitle}</p>
        )}
      </div>
      {actionLabel && (
        <button type="button" className="btn btn-ghost" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
    {children}
  </section>
);

const Home = () => {
  const [listings, setListings] = useState([]);
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [listingsRes, feedRes] = await Promise.all([
          listingAPI.getAll({ limit: 4 }),
          aiAPI.getRecommendationFeed({ limit: 12 }),
        ]);
        setListings(listingsRes.data.data || []);
        setFeed(feedRes.data.data || null);
      } catch (err) {
        console.error('Failed to fetch home data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const because = feed?.becauseYouSearched;
  const personalized = feed?.personalizedListings || [];
  const trending = feed?.trendingInCategory || [];
  const similar = feed?.similarUsersAlsoViewed || [];
  const legacyRecs = feed?.recommendedListings || [];

  return (
    <div className="page-container">

      <section style={{
        padding: '40px 0',
        textAlign: 'center',
        background: 'linear-gradient(135deg, var(--cx-primary) 0%, #6366f1 100%)',
        borderRadius: '16px',
        color: 'white',
        marginBottom: '40px'
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '12px' }}>Welcome to CommuneX</h1>
        <p style={{ fontSize: '1.1rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto' }}>
          Your campus marketplace — listings and services tailored to what you actually browse and search for.
        </p>
      </section>

      <section>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px"
        }}>
          <h2 className="section-title">Latest Listings</h2>
          <button className="btn btn-ghost" onClick={() => navigate("/marketplace")}>
            View All Marketplace →
          </button>
        </div>

        {loading ? (
          <div className="loading-container" style={{ minHeight: '200px' }}>
            <div className="spinner" />
          </div>
        ) : listings.length > 0 ? (
          <div className="card-grid">
            {listings.map(item => (
              <ListingCard key={item._id} listing={item} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No listings found. Be the first to post!</p>
            <button className="btn btn-primary" onClick={() => navigate("/marketplace/create")}>Post Item</button>
          </div>
        )}
      </section>

      {!loading && because?.listings?.length > 0 && (
        <Section
          title='Because you searched…'
          subtitle={because.subtitle}
          actionLabel="Smart Search →"
          onAction={() => navigate("/ai-search")}
        >
          <div className="card-grid">
            {because.listings.map((item) => (
              <ListingCard key={item._id} listing={item} />
            ))}
          </div>
        </Section>
      )}

      {!loading && personalized.length > 0 && (
        <Section
          title="Picked for you"
          subtitle="Ranked from your views, saves, and searches."
          actionLabel="AI recommendations →"
          onAction={() => navigate("/recommendations")}
        >
          <div className="card-grid">
            {personalized.map((item) => (
              <ListingCard key={item._id} listing={item} />
            ))}
          </div>
        </Section>
      )}

      {!loading && trending.length > 0 && (
        <Section
          title="Trending in your top category"
          subtitle="Popular listings where you spend the most time."
          actionLabel="Browse marketplace →"
          onAction={() => navigate("/marketplace")}
        >
          <div className="card-grid">
            {trending.map((item) => (
              <ListingCard key={item._id} listing={item} />
            ))}
          </div>
        </Section>
      )}

      {!loading && similar.length > 0 && (
        <Section
          title="People with similar interests also viewed"
          subtitle="Items that share tags with things you have saved."
          actionLabel="Saved items →"
          onAction={() => navigate("/saved-items")}
        >
          <div className="card-grid">
            {similar.map((item) => (
              <ListingCard key={item._id} listing={item} />
            ))}
          </div>
        </Section>
      )}

      {!loading && legacyRecs.length > 0 && !(personalized.length || similar.length) && (
        <Section
          title="Recommended for You"
          subtitle="Based on favorites and saved tags."
          actionLabel="Personalized Search →"
          onAction={() => navigate("/ai-search")}
        >
          <div className="card-grid">
            {legacyRecs.slice(0, 4).map((item) => (
              <ListingCard key={item._id} listing={item} />
            ))}
          </div>
        </Section>
      )}

    </div>
  );
};

export default Home;
