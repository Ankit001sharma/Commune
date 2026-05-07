import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from '../Icons';

const BackButton = ({ fallback = '/' }) => {
  const navigate = useNavigate();

  const goBack = () => {
    const canGoBack =
      typeof window !== 'undefined' &&
      window.history &&
      window.history.length > 1;

    if (canGoBack) navigate(-1);
    else navigate(fallback);
  };

  return (
    <button type="button" className="back-button" onClick={goBack} title="Go back">
      <ChevronLeftIcon size={18} />
      Back
    </button>
  );
};

export default BackButton;
