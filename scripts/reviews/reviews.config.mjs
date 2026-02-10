export const BROKERS = [
  { slug: 'libertex', name: 'Libertex', logoUrl: 'https://m.media-amazon.com/images/I/211mixnZiOL.png' },
  { slug: 'xm-group', name: 'XM Group', logoUrl: 'https://www.alphanews.live/wp-content/uploads/2025/05/Slide1.jpeg' },
  { slug: 'exness', name: 'Exness', logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR0PY9pM9tFSWo_L0mA9rkQmQGPrRwbba_wxQ&s' },
  { slug: 'pepperstone', name: 'Pepperstone', logoUrl: 'https://cdn.worldvectorlogo.com/logos/pepperstone.svg' },
];

export function isKnownBrokerSlug(slug) {
  return BROKERS.some((b) => b.slug === slug);
}

