// SVG artwork from seasons-mockup.src.html (Null Core, 2026-11-11).
import { useId } from 'react';

export function GardenBed() {
  const id = useId();
  return (
    <svg
      data-seasonal-art="GardenBed"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 104 100"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-tulip`} x1="0" y1="0" x2=".7" y2="1">
          <stop stopColor="#ffd5cf" />
          <stop offset=".46" stopColor="#f591a4" />
          <stop offset="1" stopColor="#d65781" />
        </linearGradient>
        <linearGradient id={`${id}-crocus`} x2=".5" y2="1">
          <stop stopColor="#ded1ff" />
          <stop offset=".5" stopColor="#aa8bdc" />
          <stop offset="1" stopColor="#7360ad" />
        </linearGradient>
        <radialGradient id={`${id}-ivory`} cx=".42" cy=".25" r=".8">
          <stop stopColor="#fffefa" />
          <stop offset=".65" stopColor="#faf1eb" />
          <stop offset="1" stopColor="#e2bbd2" />
        </radialGradient>
        <linearGradient id={`${id}-leaf`} x2="1" y2="1">
          <stop stopColor="#b5d5a2" />
          <stop offset=".5" stopColor="#71a88c" />
          <stop offset="1" stopColor="#457e6c" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#729f76" strokeWidth="2" strokeLinecap="round">
        <path d="M48 94C51 76 54 52 54 37M18 94C19 75 22 56 21 45M77 94L79 62" />
      </g>
      <g fill={`url(#${id}-leaf)`}>
        <path d="M44 95C23 87 24 65 28 57C39 65 43 80 44 95Z" />
        <path d="M51 94C53 67 68 57 75 55C70 73 62 86 51 94Z" />
        <path d="M18 95C4 79 3 68 6 60C15 70 19 82 18 95Z" />
        <path d="M73 95C80 79 91 76 98 77C91 87 82 92 73 95Z" />
      </g>
      <g transform="translate(19 43) rotate(-18) scale(0.69)">
        <path
          transform="rotate(0)"
          d="M0 3C-11-4-9-16 0-21C9-16 11-4 0 3Z"
          fill={`url(#${id}-ivory)`}
          stroke="#d7cda3"
          strokeWidth=".5"
        />
        <path
          transform="rotate(60)"
          d="M0 3C-11-4-9-16 0-21C9-16 11-4 0 3Z"
          fill={`url(#${id}-ivory)`}
          stroke="#d7cda3"
          strokeWidth=".5"
        />
        <path
          transform="rotate(120)"
          d="M0 3C-11-4-9-16 0-21C9-16 11-4 0 3Z"
          fill={`url(#${id}-ivory)`}
          stroke="#d7cda3"
          strokeWidth=".5"
        />
        <path
          transform="rotate(180)"
          d="M0 3C-11-4-9-16 0-21C9-16 11-4 0 3Z"
          fill={`url(#${id}-ivory)`}
          stroke="#d7cda3"
          strokeWidth=".5"
        />
        <path
          transform="rotate(240)"
          d="M0 3C-11-4-9-16 0-21C9-16 11-4 0 3Z"
          fill={`url(#${id}-ivory)`}
          stroke="#d7cda3"
          strokeWidth=".5"
        />
        <path
          transform="rotate(300)"
          d="M0 3C-11-4-9-16 0-21C9-16 11-4 0 3Z"
          fill={`url(#${id}-ivory)`}
          stroke="#d7cda3"
          strokeWidth=".5"
        />
        <path
          d="M-7-2C-7-6 7-6 7-2L9 6C5 12-5 12-9 6Z"
          fill="#efb743"
          stroke="#d79a2e"
          strokeWidth=".7"
        />
        <ellipse cy="5" rx="6.4" ry="4.2" fill="#f8d464" />
        <path d="M-4 5C-1 1 3 2 4 5" fill="none" stroke="#cb8d2a" strokeWidth="1" />
        <circle cy="4.5" r="1.4" fill="#ffec94" />
      </g>
      <g transform="translate(54 31) rotate(5) scale(0.78)">
        <path
          d="M0 14C-18 13-24-6-17-23L-7-14C-4-32 5-31 9-15L19-24C26-7 19 12 0 14Z"
          fill={`url(#${id}-tulip)`}
          stroke="#c56788"
          strokeWidth=".6"
        />
        <path d="M-17-23C-20-3-10 10 0 14C-7 1-7-8-7-14Z" fill="#cf6a8c" opacity=".46" />
        <path d="M19-24C20-6 11 7 0 14C9 1 10-10 9-15Z" fill="#ffdfd5" opacity=".65" />
        <path d="M-1-15C-6-8-3 5 0 12" fill="none" stroke="#fbd0cd" strokeWidth="1" opacity=".7" />
      </g>
      <g transform="translate(80 63) scale(0.48)">
        <path d="M0 17C-17 10-19-7-10-16C-4-12 0 1 0 17Z" fill="#a68ad4" />
        <path d="M0 17C17 10 19-7 10-16C4-12 0 1 0 17Z" fill="#c1a9e8" />
        <path d="M0 17C-10 6-8-13 0-22C8-13 10 6 0 17Z" fill={`url(#${id}-crocus)`} />
        <path d="M-2 3V-5M2 3V-7" stroke="#edc164" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function GardenTulip() {
  const id = useId();
  return (
    <svg
      data-seasonal-art="GardenTulip"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 52 70"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-tulip`} x1="0" y1="0" x2=".7" y2="1">
          <stop stopColor="#ffd5cf" />
          <stop offset=".46" stopColor="#f591a4" />
          <stop offset="1" stopColor="#d65781" />
        </linearGradient>
        <linearGradient id={`${id}-crocus`} x2=".5" y2="1">
          <stop stopColor="#ded1ff" />
          <stop offset=".5" stopColor="#aa8bdc" />
          <stop offset="1" stopColor="#7360ad" />
        </linearGradient>
        <radialGradient id={`${id}-ivory`} cx=".42" cy=".25" r=".8">
          <stop stopColor="#fffefa" />
          <stop offset=".65" stopColor="#faf1eb" />
          <stop offset="1" stopColor="#e2bbd2" />
        </radialGradient>
        <linearGradient id={`${id}-leaf`} x2="1" y2="1">
          <stop stopColor="#b5d5a2" />
          <stop offset=".5" stopColor="#71a88c" />
          <stop offset="1" stopColor="#457e6c" />
        </linearGradient>
      </defs>
      <path d="M25 67C24 51 26 39 27 28" fill="none" stroke="#76a17e" strokeWidth="1.7" />
      <path d="M25 65C10 56 10 42 13 37C22 44 26 54 25 65Z" fill={`url(#${id}-leaf)`} />
      <g transform="translate(27 25) rotate(9) scale(0.65)">
        <path
          d="M0 14C-18 13-24-6-17-23L-7-14C-4-32 5-31 9-15L19-24C26-7 19 12 0 14Z"
          fill={`url(#${id}-tulip)`}
          stroke="#c56788"
          strokeWidth=".6"
        />
        <path d="M-17-23C-20-3-10 10 0 14C-7 1-7-8-7-14Z" fill="#cf6a8c" opacity=".46" />
        <path d="M19-24C20-6 11 7 0 14C9 1 10-10 9-15Z" fill="#ffdfd5" opacity=".65" />
        <path d="M-1-15C-6-8-3 5 0 12" fill="none" stroke="#fbd0cd" strokeWidth="1" opacity=".7" />
      </g>
    </svg>
  );
}

export function GardenDaffodil() {
  const id = useId();
  return (
    <svg
      data-seasonal-art="GardenDaffodil"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 52 54"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-tulip`} x1="0" y1="0" x2=".7" y2="1">
          <stop stopColor="#ffd5cf" />
          <stop offset=".46" stopColor="#f591a4" />
          <stop offset="1" stopColor="#d65781" />
        </linearGradient>
        <linearGradient id={`${id}-crocus`} x2=".5" y2="1">
          <stop stopColor="#ded1ff" />
          <stop offset=".5" stopColor="#aa8bdc" />
          <stop offset="1" stopColor="#7360ad" />
        </linearGradient>
        <radialGradient id={`${id}-ivory`} cx=".42" cy=".25" r=".8">
          <stop stopColor="#fffefa" />
          <stop offset=".65" stopColor="#faf1eb" />
          <stop offset="1" stopColor="#e2bbd2" />
        </radialGradient>
        <linearGradient id={`${id}-leaf`} x2="1" y2="1">
          <stop stopColor="#b5d5a2" />
          <stop offset=".5" stopColor="#71a88c" />
          <stop offset="1" stopColor="#457e6c" />
        </linearGradient>
      </defs>
      <path
        d="M21 51L24 27M21 49C9 43 8 37 10 33C17 36 21 41 21 49Z"
        fill="none"
        stroke="#80a681"
        strokeWidth="1.5"
      />
      <g transform="translate(24 23) rotate(-16) scale(0.82)">
        <path
          transform="rotate(0)"
          d="M0 3C-11-4-9-16 0-21C9-16 11-4 0 3Z"
          fill={`url(#${id}-ivory)`}
          stroke="#d7cda3"
          strokeWidth=".5"
        />
        <path
          transform="rotate(60)"
          d="M0 3C-11-4-9-16 0-21C9-16 11-4 0 3Z"
          fill={`url(#${id}-ivory)`}
          stroke="#d7cda3"
          strokeWidth=".5"
        />
        <path
          transform="rotate(120)"
          d="M0 3C-11-4-9-16 0-21C9-16 11-4 0 3Z"
          fill={`url(#${id}-ivory)`}
          stroke="#d7cda3"
          strokeWidth=".5"
        />
        <path
          transform="rotate(180)"
          d="M0 3C-11-4-9-16 0-21C9-16 11-4 0 3Z"
          fill={`url(#${id}-ivory)`}
          stroke="#d7cda3"
          strokeWidth=".5"
        />
        <path
          transform="rotate(240)"
          d="M0 3C-11-4-9-16 0-21C9-16 11-4 0 3Z"
          fill={`url(#${id}-ivory)`}
          stroke="#d7cda3"
          strokeWidth=".5"
        />
        <path
          transform="rotate(300)"
          d="M0 3C-11-4-9-16 0-21C9-16 11-4 0 3Z"
          fill={`url(#${id}-ivory)`}
          stroke="#d7cda3"
          strokeWidth=".5"
        />
        <path
          d="M-7-2C-7-6 7-6 7-2L9 6C5 12-5 12-9 6Z"
          fill="#efb743"
          stroke="#d79a2e"
          strokeWidth=".7"
        />
        <ellipse cy="5" rx="6.4" ry="4.2" fill="#f8d464" />
        <path d="M-4 5C-1 1 3 2 4 5" fill="none" stroke="#cb8d2a" strokeWidth="1" />
        <circle cy="4.5" r="1.4" fill="#ffec94" />
      </g>
    </svg>
  );
}
