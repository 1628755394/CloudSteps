import {
  Utensils,
  Plane,
  Briefcase,
  Building2,
  ShoppingBag,
  MessageCircle,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  utensils: Utensils,
  plane: Plane,
  briefcase: Briefcase,
  building: Building2,
  "shopping-bag": ShoppingBag,
};

interface ScenarioIconProps extends LucideProps {
  name?: string;
}

export function ScenarioIcon({ name, className, size = 24, ...props }: ScenarioIconProps) {
  const Icon = (name && ICON_MAP[name]) || MessageCircle;
  return <Icon className={className} size={size} {...props} />;
}
