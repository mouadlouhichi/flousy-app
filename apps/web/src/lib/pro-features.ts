export type ProUserLike = {
  plan?: string | null;
} | null;

export function isProUser(
  profile: ProUserLike,
  storage: Pick<Storage, 'getItem'> = typeof window !== 'undefined' ? window.localStorage : undefined as never,
): boolean {
  if (!profile) return false;
  if (profile.plan === 'pro') return true;

  if (storage?.getItem?.('flousy_pro_plan') === 'true') return true;
  return false;
}
