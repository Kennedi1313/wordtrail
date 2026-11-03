import { BookOpen, Brain, Home, Library } from "lucide-react";

type NavIconName = "home" | "reading" | "practice" | "vocabulary";

const icons = {
  home: Home,
  reading: BookOpen,
  practice: Brain,
  vocabulary: Library,
};

export function NavIcon({ name }: { name: NavIconName }) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className="nav-icon" />;
}
