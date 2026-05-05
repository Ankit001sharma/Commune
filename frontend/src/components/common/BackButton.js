import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from '../Icons';

const BackButton = ({ fallback = '/' }) => {
  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
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
