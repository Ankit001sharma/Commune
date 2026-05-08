import React, { useEffect, useState } from 'react';

const SplashScreen = ({ children }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
    }, 1600);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <>
      {visible && (
        <div className="splash-screen">
          <div className="splash-logo-wrap">
            <img src="/logo.jpeg" alt="CommuneX" className="splash-logo" />
          </div>
        </div>
      )}
      <div className={visible ? 'app-after-splash hidden' : 'app-after-splash'}>{children}</div>
    </>
  );
};

export default SplashScreen;
