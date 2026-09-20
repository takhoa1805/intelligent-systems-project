import { BatteryCharging, Headphones, Lightbulb, Smartphone, Speaker, Cable, Shield, Wifi, Zap } from 'lucide-react';

const chooseIcon = (product) => {
  const text = `${product.name} ${(product.tags || []).join(' ')}`.toLowerCase();
  if (text.includes('phone') && !text.includes('head')) return Smartphone;
  if (text.includes('headphone')) return Headphones;
  if (text.includes('speaker')) return Speaker;
  if (text.includes('battery') || text.includes('power bank')) return BatteryCharging;
  if (text.includes('case')) return Shield;
  if (text.includes('cable')) return Cable;
  if (text.includes('light')) return Lightbulb;
  if (text.includes('wireless')) return Wifi;
  return Zap;
};

export default function ProductVisual({ product, large = false }) {
  const Icon = chooseIcon(product);
  return <div className={`product-visual ${large ? 'large' : ''}`} style={{ '--accent': product.accent || '#E9562A' }}>
    <span className="visual-orbit" /><span className="visual-orbit two" />
    <Icon strokeWidth={1.35} />
    <small>{product.category}</small>
  </div>;
}
