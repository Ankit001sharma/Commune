import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppImage from "../components/common/AppImage";


const Home = () => {
  const [listings, setListings] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:5000/api/listings")
      .then(res => res.json())
      .then(data => setListings(data.data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div style={{ padding: "24px" }}>
      
      {/* Welcome */}
      <h1>Welcome to CommuneX 🚀</h1>
      <p>Your campus marketplace platform</p>

      {/* Latest Listings */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "30px"
      }}>
        <h2>Latest Listings</h2>

        <button
          onClick={() => navigate("/marketplace")}
          style={{
            background: "#6C63FF",
            color: "#fff",
            border: "none",
            padding: "8px 14px",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          View All →
        </button>
      </div>

      {/* Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
        marginTop: "16px"
      }}>
        {listings.slice(0, 4).map(item => (
          <div
            key={item._id}
            onClick={() => navigate(`/marketplace/${item._id}`)}
            style={{
              background: "#fff",
              borderRadius: "12px",
              overflow: "hidden",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
            }}
          >
            {/* Image */}
            <AppImage
            src={`http://localhost:5000${item.images[0]?.url}`}
            height={160}
            />

            {/* Content */}
            <div style={{ padding: "10px" }}>
              <h3 style={{ margin: "0" }}>{item.title}</h3>
              <p style={{ margin: "5px 0", fontWeight: "600" }}>
                ₹{item.price}
              </p>
              <p style={{ fontSize: "12px", color: "gray" }}>
                {item.location}
              </p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default Home;