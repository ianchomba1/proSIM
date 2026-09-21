import React from 'react';

export const CrestLogo: React.FC<{ size?: number }> = ({ size = 32 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
    >
      {/* Outer Decorative Rings */}
      <circle cx="50" cy="50" r="46" stroke="#94a3b8" strokeWidth="1.5" opacity="0.6" />
      <circle cx="50" cy="50" r="42" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />
      <circle cx="50" cy="50" r="38" stroke="#cbd5e1" strokeWidth="1.5" />
      
      {/* Stars on top/sides */}
      <polygon points="50,15 51.5,18 55,18 52,20 53,23.5 50,21.5 47,23.5 48,20 45,18 48.5,18" fill="#e2e8f0" />
      <polygon points="20,50 21.5,53 25,53 22,55 23,58.5 20,56.5 17,58.5 18,55 15,53 18.5,53" fill="#94a3b8" opacity="0.7" />
      <polygon points="80,50 81.5,53 85,53 82,55 83,58.5 80,56.5 77,58.5 78,55 75,53 78.5,53" fill="#94a3b8" opacity="0.7" />

      {/* Central Shield */}
      <path 
        d="M50 26 C64 26, 72 32, 72 48 C72 66, 58 78, 50 84 C42 78, 28 66, 28 48 C28 32, 36 26, 50 26 Z" 
        fill="#0f172a" 
        stroke="#cbd5e1" 
        strokeWidth="2" 
      />

      {/* Shield Internal Quadrant Divider */}
      <line x1="50" y1="30" x2="50" y2="78" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
      <line x1="32" y1="52" x2="68" y2="52" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />

      {/* Book of Knowledge Symbol inside Shield Top Left */}
      <path d="M38 38 Q43 36, 47 38 L47 48 Q43 46, 38 48 Z" stroke="#e2e8f0" strokeWidth="1.2" fill="none" />
      <path d="M47 38 Q51 36, 56 38 L56 48 Q51 46, 47 48 Z" stroke="#e2e8f0" strokeWidth="1.2" fill="none" />

      {/* Torch/Flame Symbol Top Right */}
      <path d="M60 48 L62 42 L64 48 Z" fill="#cbd5e1" />
      <path d="M63 36 Q67 40, 63 42 Q61 38, 63 36 Z" fill="#3b82f6" />

      {/* SIM / Microchip Symbol Bottom */}
      <rect x="44" y="60" width="12" height="12" rx="2" stroke="#e2e8f0" strokeWidth="1.2" fill="none" />
      <line x1="47" y1="60" x2="47" y2="57" stroke="#e2e8f0" strokeWidth="1" />
      <line x1="53" y1="60" x2="53" y2="57" stroke="#e2e8f0" strokeWidth="1" />
      <line x1="47" y1="72" x2="47" y2="75" stroke="#e2e8f0" strokeWidth="1" />
      <line x1="53" y1="72" x2="53" y2="75" stroke="#e2e8f0" strokeWidth="1" />

      {/* Laurel Wreath Accents Outside Shield */}
      <path d="M22 42 C18 52, 22 66, 30 74" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8" />
      <path d="M78 42 C82 52, 78 66, 70 74" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8" />
    </svg>
  );
};
