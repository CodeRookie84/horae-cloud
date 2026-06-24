/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface HoraeLogoIconProps {
  className?: string;
  hColor?: string; // Custom color override for the 'h' shape
}

export default function HoraeLogoIcon({ 
  className = "w-8 h-8", 
  hColor = "#162D4E" 
}: HoraeLogoIconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left vertical bar of h */}
      <rect x="18" y="10" width="15" height="80" rx="7.5" fill={hColor} />
      {/* Right vertical bar of h */}
      <rect x="48" y="45" width="15" height="45" rx="7.5" fill={hColor} />
      {/* Curved bridge connecting them */}
      <path d="M33 52C33 42 38 38 48 38V52H33Z" fill={hColor} />
      <rect x="33" y="46" width="15" height="10" fill={hColor} />
      
      {/* Golden Gear & Clock face in the notch */}
      <g transform="translate(37, 28)">
        {/* Gear circle background */}
        <circle cx="0" cy="0" r="14" fill="#FFFFFF" stroke="#C5A880" strokeWidth="3" />
        {/* Gear teeth */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="-2.5"
            y="-16.5"
            width="5"
            height="3.5"
            rx="1"
            fill="#C5A880"
            transform={`rotate(${angle})`}
          />
        ))}
        {/* Clock Hands */}
        <line x1="0" y1="0" x2="0" y2="-6.5" stroke="#162D4E" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="0" y1="0" x2="4.5" y2="2" stroke="#162D4E" strokeWidth="2.2" strokeLinecap="round" />
        {/* Center dot */}
        <circle cx="0" cy="0" r="1.2" fill="#162D4E" />
      </g>
    </svg>
  );
}
