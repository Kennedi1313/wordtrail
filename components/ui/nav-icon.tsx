import { BookOpen, Brain, Home, Letters, Library, Users } from "lucide-react";

type NavIconName =
  "home" | "reading" | "practice" | "vocabulary" | "books" | "clubs";

const icons = {
  home: Home,
  reading: BookOpen,
  practice: Brain,
  vocabulary: Letters,
  books: Library,
  clubs: Users,
};

export function NavIcon({ name }: { name: NavIconName }) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className="nav-icon" />;
}
