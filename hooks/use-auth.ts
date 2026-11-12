import { useWordtrail } from "@/hooks/use-wordtrail";

export function useAuth() {
  const { user, authReady, signIn, signOut, configured } = useWordtrail();
  return { user, ready: authReady, signIn, signOut, configured };
}
