import React from "react";

const AppImage = ({
  src,
  alt = "",
  height = 200,
  width = "100%",
  style = {},
  className = "",
}) => {
  return (
    <div
      style={{
        width,
        height,
        background: "#f3f4f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: "10px",
      }}
      className={className}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",   // 🔥 GLOBAL FIX
          ...style,
        }}
      />
    </div>
  );
};

export default AppImage;