import React, { useState } from 'react';

export function Button({ label, onClick, disabled = false }) {
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = () => {
    setIsPressed(true);
    onClick?.();
    setTimeout(() => setIsPressed(false), 200);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={isPressed ? 'pressed' : ''}
    >
      {label}
    </button>
  );
}

export default Button;
