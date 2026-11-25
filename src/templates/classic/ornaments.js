// Semua ornamen memakai currentColor, jadi warnanya mengikuti tema.
const petals = [0, 45, 90, 135, 180, 225, 270, 315]
  .map((a) => `<ellipse cy="-24" rx="10" ry="20" transform="rotate(${a})"/>`)
  .join('');

const STAR = 'M50 8L58 42L92 50L58 58L50 92L42 58L8 50L42 42Z';

export const ORNAMENTS = {
  flower: {
    viewBox: '0 0 100 100',
    body:
      `<mask id="orn-hole"><rect width="100" height="100" fill="#fff"/><circle cx="50" cy="50" r="8" fill="#000"/></mask>` +
      `<g mask="url(#orn-hole)"><g transform="translate(50 50)">${petals}</g></g><circle cx="50" cy="50" r="4"/>`,
  },
  branch: {
    viewBox: '0 0 100 100',
    body:
      `<path d="M8 92C30 70 50 45 88 10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>` +
      `<ellipse cx="19" cy="69" rx="4.5" ry="10" transform="rotate(-25 19 69)"/>` +
      `<ellipse cx="41" cy="68" rx="4.5" ry="10" transform="rotate(65 41 68)"/>` +
      `<ellipse cx="43" cy="46" rx="4.5" ry="10" transform="rotate(-25 43 46)"/>` +
      `<ellipse cx="65" cy="44" rx="4.5" ry="10" transform="rotate(65 65 44)"/>` +
      `<ellipse cx="67" cy="21" rx="4.5" ry="10" transform="rotate(-25 67 21)"/>` +
      `<ellipse cx="87" cy="19" rx="4.5" ry="10" transform="rotate(65 87 19)"/>` +
      `<ellipse cx="90" cy="8" rx="3" ry="7" transform="rotate(40 90 8)"/>`,
  },
  corner: {
    viewBox: '0 0 100 100',
    body:
      `<path d="M6 94C6 40 40 6 94 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>` +
      `<g transform="translate(22 22)"><circle cy="-6" r="4.5"/><circle cx="5.7" cy="-1.8" r="4.5"/><circle cx="3.5" cy="4.9" r="4.5"/><circle cx="-3.5" cy="4.9" r="4.5"/><circle cx="-5.7" cy="-1.8" r="4.5"/></g>` +
      `<ellipse cx="12" cy="58" rx="3.5" ry="8" transform="rotate(-12 12 58)"/>` +
      `<ellipse cx="58" cy="12" rx="3.5" ry="8" transform="rotate(78 58 12)"/>` +
      `<circle cx="9" cy="76" r="2.5"/><circle cx="76" cy="9" r="2.5"/>`,
  },
  divider: {
    viewBox: '0 0 200 30',
    body:
      `<path d="M0 15H78M122 15H200" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M100 4L108 15L100 26L92 15Z"/><circle cx="84" cy="15" r="2.5"/><circle cx="116" cy="15" r="2.5"/>`,
  },
  sparkle: {
    viewBox: '0 0 100 100',
    body:
      `<path d="${STAR}"/>` +
      `<path d="${STAR}" transform="translate(66 6) scale(.28)"/>` +
      `<path d="${STAR}" transform="translate(9 71) scale(.22)"/>`,
  },
};