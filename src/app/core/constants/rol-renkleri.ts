/** Rol avatarı ve rozet renkleri; rol kimliğine göre sabit seçilir, böylece bir rol her ekranda aynı renktedir. */
const ROL_RENKLERI = ['#605dff', '#0ea5e9', '#16a34a', '#e8890c', '#db2777', '#7c3aed', '#0d9488', '#dc2626'];

export function rolRengi(rolId: number): string {
  return ROL_RENKLERI[Math.abs(rolId) % ROL_RENKLERI.length];
}
