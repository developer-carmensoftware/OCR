/**
 * Entrance motion for the pricing catalog, shared by the plan grid and the top-up
 * rail so the whole page enters in one voice. Gate with `useEntrance`:
 * `initial={enter ? 'hidden' : false}`.
 */

export const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
}

export const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 120,
      damping: 14,
    },
  },
}
