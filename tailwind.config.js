module.exports = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { pitch: '#0B0B0B', chalk: '#F4F4F2', line: '#E3E3DE', flare: '#E10600', ink: '#0B0B0B', lime: '#E8FF2A' },
    fontFamily: { display: ['var(--f-display)', 'Arial Black', 'sans-serif'], sans: ['var(--f-body)', 'system-ui', 'sans-serif'], cond: ['var(--f-cond)', 'Impact', 'sans-serif'] },
    keyframes: { fadeIn: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } } },
    animation: { 'fade-in': 'fadeIn .6s ease both' },
  } },
};
