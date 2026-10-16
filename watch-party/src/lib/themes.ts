import romantic from "@/assets/theme-romantic.jpg";
import sports from "@/assets/theme-sports.jpg";
import friends from "@/assets/theme-friends.jpg";

export type ThemeId = "romantic" | "sports" | "friends";

export const THEMES: Record<ThemeId, { id: ThemeId; name: string; tagline: string; image: string; accent: string; ring: string }> = {
  romantic: { id: "romantic", name: "Romantic", tagline: "Drive-in under the stars", image: romantic, accent: "text-romantic", ring: "ring-romantic" },
  sports: { id: "sports", name: "Sports", tagline: "Floodlights and a roaring crowd", image: sports, accent: "text-sports", ring: "ring-sports" },
  friends: { id: "friends", name: "Friends & Family", tagline: "Beanbags, blankets and popcorn", image: friends, accent: "text-friends", ring: "ring-friends" },
};

export function getTheme(id: string | null | undefined) {
  return THEMES[(id as ThemeId) in THEMES ? (id as ThemeId) : "friends"];
}
