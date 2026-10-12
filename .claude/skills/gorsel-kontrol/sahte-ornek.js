// Görsel kontrol için sahte veri modülü örneği. Bunu scratchpad'e kopyalayıp ekrana göre doldurun; depoya gerçek
// müşteri/proje verisi koymayın, sentetik değerler kullanın.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const C = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/';

// İmzasız (alg: none) önizleme belirteci: yalnız ön yüzün oturum kontrolünü geçmek içindir; gerçek API'ye gitmez.
exports.token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
  [C + 'nameidentifier']: '1', [C + 'name']: 'Önizleme Kullanıcısı', [C + 'emailaddress']: 'onizleme@example.test',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Admin', RolId: '1', BasHarf: 'ÖK',
  exp: String(Math.floor(Date.now() / 1000) + 3600),
})}.imza`;

// Menü ağacı izinleri belirler: yetkiTipiId 3 = W, 2 = R, 1 = N. Ekranın ve işlemlerin kodlarını ekleyin.
let id = 1;
const dugum = (kod, route = null, children = [], tip = 3) =>
  ({ id: id++, kod, labelKey: kod, icon: route ? 'ri-folder-line' : '', route, sira: id, yetkiTipiId: tip, yetkiTipiMetni: tip === 3 ? 'W' : 'R', children });
const MENU = [
  dugum('dashboard', '/dashboard'),
  dugum('projeler', null, [dugum('aktif-projeler', '/projeler'), dugum('proje-sevk-et')]),
];

const sayfa = (items) => ({ items, pageNumber: 1, pageSize: 25, totalCount: items.length, totalPages: 1, hasPreviousPage: false, hasNextPage: false });

exports.yanit = (url, method) => {
  const p = new URL(url).pathname.replace(/^\/api/, '').toLowerCase();
  if (p.startsWith('/menu/kullanici-menu')) return MENU;
  if (p === '/proje') return sayfa([]);
  // Hata yanıtı örneği: { __durum: 409, govde: { message: '…', issues: [...] } }
  return [];
};
