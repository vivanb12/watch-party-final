export type Profile = { name: string; color: string };

export const AVATAR_COLORS = ["seat", "primary", "sports", "romantic", "success", "friends"] as const;

export function getSessionId(): string {
  let id = localStorage.getItem("wp.session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("wp.session", id);
  }
  return id;
}

export function getProfile(): Profile | null {
  try {
    const raw = localStorage.getItem("wp.profile");
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  localStorage.setItem("wp.profile", JSON.stringify(p));
}
