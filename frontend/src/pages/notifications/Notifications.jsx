import React, { useEffect, useState } from "react";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/notifications", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`, // 🔥 IMPORTANT
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setNotifications(data.data || []);
      })
      .catch((err) => console.error(err));
  }, []);

  return (
    <div style={{ padding: "24px" }}>
      <h2>Notifications</h2>

      {notifications.length === 0 ? (
        <p>No notifications yet</p>
      ) : (
        notifications.map((n) => (
          <div
            key={n._id}
            style={{
              padding: "12px",
              marginBottom: "10px",
              borderRadius: "8px",
              background: n.isRead ? "#fff" : "#eef2ff",
              cursor: "pointer",
            }}
          >
            {n.text}
          </div>
        ))
      )}
    </div>
  );
};

export default Notifications;