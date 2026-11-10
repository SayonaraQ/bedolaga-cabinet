// SVG artwork from seasons-mockup.src.html (Null Core, 2026-11-11).
import { useId } from 'react';

export function SnowCap() {
  const id = useId();
  return (
    <svg
      data-seasonal-art="SnowCap"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 188 30"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff" />
          <stop offset=".55" stopColor="#effaff" />
          <stop offset="1" stopColor="#bddce9" />
        </linearGradient>
      </defs>
      <g>
        <path
          d="M2 20C8 14 17 16 23 13C25 5 35 1 44 5C48 0 58 0 66 5C72 3 80 5 85 10C95 6 105 8 110 14C120 12 130 13 135 18C143 16 154 18 159 23C145 27 131 23 118 25C100 27 89 23 76 25C60 28 48 24 35 25C21 27 6 26 2 20Z"
          fill={`url(#${id})`}
        />
        <path
          d="M17 16C27 10 31 12 36 13M45 8C50 5 54 5 59 8M89 13L96 13"
          fill="none"
          stroke="#fff"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity=".8"
        />
        <g fill="#fff" opacity=".8">
          <circle cx="47" cy="15" r=".8" />
          <circle cx="71" cy="11" r=".65" />
          <circle cx="118" cy="18" r=".7" />
          <circle cx="33" cy="19" r=".6" />
        </g>
      </g>
    </svg>
  );
}

export function SnowRight() {
  const id = useId();
  return (
    <svg
      data-seasonal-art="SnowRight"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 188 30"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff" />
          <stop offset=".55" stopColor="#effaff" />
          <stop offset="1" stopColor="#bddce9" />
        </linearGradient>
      </defs>
      <g transform="translate(188 0) scale(-1 1)">
        <path
          d="M2 21C4 16 9 15 16 15C20 8 28 7 35 10C41 1 51 1 60 7C68 4 78 5 82 11C91 8 102 11 106 15C116 12 126 14 131 18C141 15 149 18 154 21C166 18 177 20 184 24C167 27 153 24 140 26C123 28 110 24 98 26C82 28 75 23 61 25C43 28 29 24 18 25C10 26 3 25 2 21Z"
          fill={`url(#${id})`}
        />
        <path
          d="M17 16C27 10 31 12 36 13M45 8C50 5 54 5 59 8M89 13L96 13"
          fill="none"
          stroke="#fff"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity=".8"
        />
        <g fill="#fff" opacity=".8">
          <circle cx="47" cy="15" r=".8" />
          <circle cx="71" cy="11" r=".65" />
          <circle cx="118" cy="18" r=".7" />
          <circle cx="33" cy="19" r=".6" />
        </g>
      </g>
    </svg>
  );
}

export function SnowFull() {
  const id = useId();
  return (
    <svg
      data-seasonal-art="SnowFull"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 360 32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff" />
          <stop offset=".55" stopColor="#effaff" />
          <stop offset="1" stopColor="#bddce9" />
        </linearGradient>
      </defs>
      <g>
        <path
          d="M2 24C5 19 11 18 20 19C29 13 42 12 54 15C66 9 81 10 95 13C109 8 127 8 141 12C155 9 174 10 188 14C204 8 219 9 233 13C247 9 261 11 274 15C288 11 303 11 315 16C328 13 342 16 349 20C354 20 358 22 358 25C343 28 327 25 311 27C292 28 277 25 259 27C239 29 221 25 204 27C183 29 167 25 150 27C127 29 113 25 95 27C76 29 59 25 43 27C27 28 10 28 2 24Z"
          fill={`url(#${id})`}
        />
        <path
          d="M17 16C27 10 31 12 36 13M45 8C50 5 54 5 59 8M89 13L96 13"
          fill="none"
          stroke="#fff"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity=".8"
        />
        <g fill="#fff" opacity=".8">
          <circle cx="47" cy="15" r=".8" />
          <circle cx="71" cy="11" r=".65" />
          <circle cx="118" cy="18" r=".7" />
          <circle cx="33" cy="19" r=".6" />
          <circle cx="205" cy="17" r=".7" />
          <circle cx="285" cy="20" r=".8" />
          <circle cx="317" cy="22" r=".6" />
        </g>
      </g>
    </svg>
  );
}

export function Snowman() {
  const id = useId();
  return (
    <svg
      data-seasonal-art="Snowman"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 88 96"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={id} cx=".32" cy=".25" r=".8">
          <stop stopColor="#fff" />
          <stop offset=".6" stopColor="#eefaff" />
          <stop offset="1" stopColor="#b1d4e2" />
        </radialGradient>
      </defs>
      <ellipse cx="44" cy="91" rx="27" ry="3" fill="#9ec7d9" opacity=".38" />
      <g fill="none" stroke="#9c8578" strokeWidth="2.2" strokeLinecap="round">
        <path d="M29 48L13 38 5 27M13 38L3 37M60 48L75 37 83 27M75 37L86 38" />
      </g>
      <circle cx="44" cy="68" r="23" fill={`url(#${id})`} stroke="#b6d4e1" strokeWidth=".65" />
      <circle cx="44" cy="47" r="18" fill={`url(#${id})`} stroke="#b6d4e1" strokeWidth=".6" />
      <circle cx="44" cy="25" r="14" fill={`url(#${id})`} stroke="#b6d4e1" strokeWidth=".6" />
      <path d="M31 36C40 40 49 40 57 35L59 42C49 47 39 45 29 41Z" fill="#b7799b" />
      <path d="M48 42L58 42 62 60 53 59Z" fill="#c68cab" />
      <path d="M54 54L61 55M53 57L62 58" stroke="#e6becf" strokeWidth="1" />
      <g fill="#38566a">
        <circle cx="39" cy="23" r="1.4" />
        <circle cx="49" cy="23" r="1.4" />
        <circle cx="43" cy="51" r="1.7" />
        <circle cx="43" cy="60" r="1.7" />
        <circle cx="43" cy="71" r="1.7" />
      </g>
      <path d="M44 26L57 29 44 30Z" fill="#e6a06b" />
      <path
        d="M37 30C39 34 44 35 48 32"
        fill="none"
        stroke="#6b8998"
        strokeWidth=".9"
        strokeLinecap="round"
      />
      <g transform="rotate(-5 44 12)">
        <rect x="31" y="1" width="25" height="15" rx="3" fill="#34576b" />
        <path d="M31 11H56V16H31Z" fill="#8db7c9" />
        <rect x="26" y="14" width="35" height="4" rx="2" fill="#29495d" />
      </g>
      <path
        d="M29 66C28 74 32 80 38 83"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        opacity=".65"
        strokeLinecap="round"
      />
    </svg>
  );
}
