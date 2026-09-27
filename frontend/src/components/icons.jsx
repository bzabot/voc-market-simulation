export function VocMark({ className, ...rest }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden {...rest}>
      <rect x="2" y="2" width="60" height="60" rx="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <text
        x="32"
        y="42"
        textAnchor="middle"
        fontFamily="Public Sans, sans-serif"
        fontWeight="600"
        fontSize="24"
        fill="currentColor"
      >
        VOC
      </text>
    </svg>
  )
}

/** Three-masted flute ship under sail. */
export function ShipIcon({ className, ...rest }) {
  return (
    <svg viewBox="0 0 48 32" className={className} fill="currentColor" aria-hidden {...rest}>
      {/* sails */}
      <path d="M14 2h3v14h-8l5-14z" opacity="0.9" />
      <path d="M23 0h3v16h-9l6-16z" opacity="0.9" />
      <path d="M32 3h3v13h-7l4-13z" opacity="0.9" />
      {/* masts */}
      <rect x="15" y="1" width="1.4" height="20" />
      <rect x="24" y="0" width="1.4" height="21" />
      <rect x="33" y="2" width="1.4" height="19" />
      {/* hull */}
      <path d="M4 21h40l-4.5 7H10L4 21z" />
      <rect x="8" y="18.5" width="32" height="2.5" rx="1" />
      {/* flag */}
      <path d="M25.4 0h6v3h-6z" opacity="0.75" />
    </svg>
  )
}

export function AnchorIcon({ className, ...rest }) {
  return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden {...rest}>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M12 7.5V21M12 21c-4.5 0-7.5-3-8-6.5M12 21c4.5 0 7.5-3 8-6.5M8.5 10.5h7" />
    </svg>
  )
}
