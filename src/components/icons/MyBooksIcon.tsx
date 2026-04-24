import React from 'react';

interface MyBooksIconProps {
  className?: string;
  style?: React.CSSProperties;
}

const MyBooksIcon: React.FC<MyBooksIconProps> = ({ className = "h-5 w-5", style }) => {
  return (
    <svg 
      className={className}
      viewBox="0 0 512 512" 
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      style={style}
    >
      <path d="M464 64H272l-64 32L144 64H48C21.5 64 0 85.5 0 112v288c0 26.5 21.5 48 48 48h96l64-32 64 32h96c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zM224 312l-64-32H64V152h96l64 32v128zm224-32h-96l-64 32V184l64-32h96v128z"/>
    </svg>
  );
};

export default MyBooksIcon;