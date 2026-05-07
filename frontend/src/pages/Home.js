import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listingAPI, aiAPI } from "../services/api";
import ListingCard from "../components/cards/ListingCard";

const Home = () => {
  const [listings, setListings] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [listingsRes, recsRes] = await Promise.all([
          listingAPI.getAll({ limit: 4 }),
          aiAPI.getRecommendations({ limit: 4 })
        ]);
        setListings(listingsRes.data.data || []);
        setRecommendations(recsRes.data.data?.listings || []);
      } catch (err) {
        console.error('Failed to fetch home data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="page-container">
      
      {/* Hero Section */}
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
          Your exclusive campus marketplace for buying, selling, and exchanging services.
        </p>
      </section>

      {/* Latest Listings */}
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

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <section style={{ marginTop: '48px' }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: "20px" 
          }}>
            <h2 className="section-title">Recommended for You</h2>
            <button className="btn btn-ghost" onClick={() => navigate("/ai-search")}>
              Personalized Search →
            </button>
          </div>
          <div className="card-grid">
            {recommendations.map((item) => (
              <ListingCard key={item._id} listing={item} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
};

export default Home;
