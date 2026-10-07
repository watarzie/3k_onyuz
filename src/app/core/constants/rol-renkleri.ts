/**
 * Rol avatarı ve rozet renkleri; rol kimliğine göre sabit seçilir, böylece bir rol her ekranda aynı renktedir.
 * "Atölye" paleti: hepsi beyaz üstünde AA kontrastı geçer (çam, çelik mavisi, zümrüt, kehribar, yanık turuncu,
 * mürdüm, çelik gri, tuğla).
 */
const ROL_RENKLERI = ['#2d5f47', '#3b6d9a', '#1f7a44', '#9a6b22', '#b4531f', '#6d4fa3', '#4f6276', '#c2402f'];

export function rolRengi(rolId: number): string {
  return ROL_RENKLERI[Math.abs(rolId) % ROL_RENKLERI.length];
}
