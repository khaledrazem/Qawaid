/**
 * Decorative elements matching qawaid-ui.
 * TextureOverlay, BackgroundPattern (image from public/assets or SVG), GoldDivider, CornerOrnament.
 */

import { useMemo } from 'react';

const GOLD = '#C6A75E';
const PRIMARY = '#0F3D2E';

interface ClassNameProps {
  className?: string;
}

/** Subtle noise grain overlay */
export function TextureOverlay({ className = '' }: ClassNameProps) {
  return (
    <div
      className={`decorative-texture ${className}`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

/** Background pattern: use image from public/assets when available, else SVG. Copy pattern1.png and pattern2.png from qawaid-ui assets into public/assets for image overlay. */
export function BackgroundPattern({
  className = '',
  opacity = 0.15,
  useImage = true,
  variant = 'random',
}: ClassNameProps & { opacity?: number; useImage?: boolean; variant?: 1 | 2 | 'random' }) {
  const imageUrl = useMemo(() => {
    if (!useImage) return null;
    if (variant === 'random') return Math.random() > 0.5 ? '/assets/pattern1.png' : '/assets/pattern2.png';
    return variant === 1 ? '/assets/pattern1.png' : '/assets/pattern2.png';
  }, [useImage, variant]);

  if (imageUrl) {
    return (
      <div
        className={`decorative-bg-pattern ${className}`}
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: '1400px auto',
          backgroundPosition: '0 0',
          backgroundRepeat: 'repeat',
          opacity,
        }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={`decorative-bg-pattern ${className}`}
      style={{ opacity }}
      aria-hidden
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="sahra-bg-pattern"
            x="0"
            y="0"
            width="120"
            height="120"
            patternUnits="userSpaceOnUse"
          >
            <g opacity="0.15" fill={PRIMARY}>
              <circle cx="60" cy="60" r="5" />
              <circle cx="20" cy="20" r="2" />
              <circle cx="100" cy="20" r="2" />
              <circle cx="20" cy="100" r="2" />
              <circle cx="100" cy="100" r="2" />
              <line x1="60" y1="0" x2="60" y2="20" stroke={PRIMARY} strokeWidth="0.5" />
              <line x1="60" y1="100" x2="60" y2="120" stroke={PRIMARY} strokeWidth="0.5" />
              <line x1="0" y1="60" x2="20" y2="60" stroke={PRIMARY} strokeWidth="0.5" />
              <line x1="100" y1="60" x2="120" y2="60" stroke={PRIMARY} strokeWidth="0.5" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sahra-bg-pattern)" />
      </svg>
    </div>
  );
}

/** Gold line with center ornament */
export function GoldDivider({ className = '' }: ClassNameProps) {
  return (
    <div className={`decorative-gold-divider ${className}`}>
      <span className="decorative-gold-divider-line" />
      <svg width="40" height="8" viewBox="0 0 40 8" fill="none" xmlns="http://www.w3.org/2000/svg" className="decorative-gold-divider-ornament">
        <path d="M20 1 L22 4 L20 7 L18 4 Z" fill={GOLD} opacity="0.5" />
        <circle cx="12" cy="4" r="1.5" fill={GOLD} opacity="0.3" />
        <circle cx="28" cy="4" r="1.5" fill={GOLD} opacity="0.3" />
      </svg>
      <span className="decorative-gold-divider-line" />
    </div>
  );
}

/** Corner ornament for logo area */
export function CornerOrnament({ className = '' }: ClassNameProps) {
  return (
    <svg
      className={className}
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M24 8 L26 16 L34 18 L26 20 L24 28 L22 20 L14 18 L22 16 Z"
        fill={GOLD}
        opacity="0.4"
      />
      <circle cx="24" cy="24" r="3" stroke={GOLD} strokeWidth="1" fill="none" opacity="0.3" />
      <circle cx="12" cy="12" r="1.5" fill={GOLD} opacity="0.3" />
      <circle cx="36" cy="12" r="1.5" fill={GOLD} opacity="0.3" />
      <circle cx="12" cy="36" r="1.5" fill={GOLD} opacity="0.3" />
      <circle cx="36" cy="36" r="1.5" fill={GOLD} opacity="0.3" />
    </svg>
  );
}
