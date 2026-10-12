---
name: gorsel-kontrol
description: Ön yüz değişikliğini giriş yapmadan, gerçek API'ye hiç istek göndermeden sahte veriyle başsız Chrome'da açar, adım adım ekran görüntüsü alır; konsol hatası ve yatay taşmayı raporlar. Angular ekranında görünür bir değişiklik (yeni sayfa, pencere, düzen, mobil görünüm) yaptıktan sonra kullan.
argument-hint: "<rota, ör. /projeler/sevkiyatlar> [genişlik]"
---

# Sahte veriyle görsel kontrol

Panel oturum ister ve gerçek API'ye bağlanır; bu skill ikisini de yerelde taklit eder. `gorsel-cek.js` derlenmiş
uygulamayı rastgele yerel porttan sunar, Chrome'a sahte (imzasız) belirteç koyar, `/api/` isteklerini sahte modülden
yanıtlar ve **yerel sunucu dışındaki her isteği engeller** (gerçek API'ye veya internete istek gitmez).

## Adımlar
1. **Derle** (Google Fonts gömme ağ hatası verebildiği için üretim değil geliştirme derlemesi):
   ```bash
   npx ng build --configuration development
   ```
2. **Sahte veri modülü** — `sahte-ornek.js`'i oturumun scratchpad klasörüne kopyalayıp doldur:
   - `MENU`: ekranın menü kodu ve gereken işlem/alan izin kodları (`yetkiTipiId` 3=W, 2=R). İzin kodları
     `src/app/core/constants/yetki-kodlari.ts` ile aynı olmalı.
   - `yanit(url, method)`: ekranın çağırdığı uçlar (`src/app/core/constants/api-endpoints.ts`), model arayüzlerine
     uygun **sentetik** veri; hata durumunu `{ __durum: 409, govde: {...} }` ile döndür. Depoya gerçek veri koyma.
3. **Adımlar** (scratchpad'de JSON): `[["01-liste", "<sayfada çalışacak JS>", 400], ...]`. JS içinde `await`
   kullanılabilir; tıklama için `document.querySelector('...').click()`, yazma için `el.value = '…';
   el.dispatchEvent(new Event('input'))`, bekleme için `await new Promise(r => setTimeout(r, 800))`.
   JSON'u Write aracıyla yaz (kabuk heredoc'unda tırnaklar bozulur).
4. **Çalıştır** (geniş ve dar ekran):
   ```bash
   node .claude/skills/gorsel-kontrol/gorsel-cek.js --sahte <scratchpad>/sahte.js --adimlar <scratchpad>/adimlar.json --yol /rota --cikti <scratchpad> --onek ekran --gen 1440 --yuk 900
   node .claude/skills/gorsel-kontrol/gorsel-cek.js --sahte <scratchpad>/sahte.js --adimlar <scratchpad>/adimlar.json --yol /rota --cikti <scratchpad> --onek mobil --gen 390 --yuk 844
   ```
   Git Bash'te `/rota` yol dönüşümüne uğramasın diye başına `MSYS_NO_PATHCONV=1` ekle; bu durumda dosya
   argümanlarını `/c/...` değil `C:/...` biçiminde ver.
   Yerel port açmak sandbox'ta engellenebilir; gerekirse sandbox dışında çalıştır.
5. **İncele**: Çıktıdaki PNG'leri Read aracıyla aç. Çıktı satırlarında `ADIM HATASI`, `YATAY TAŞMA`, konsol hataları
   ve engellenen dış istekler raporlanır; "konsol temiz" beklenir. Bildirim akışı (SSE) hataları ve
   `fonts.googleapis.com` engeli sahte ortamda beklenir, ayrı satırda sayılır.

## Rapor
Kullanıcıya hangi ekranı, hangi genişliklerde, hangi adımlarla kontrol ettiğini; konsol/taşma sonucunu ve kontrolün
**sahte veriyle** yapıldığını (canlı veriyle ayrıca denenmesi gerektiğini) söyle. Ekran görüntülerini scratchpad'de
bırak; depoya ekleme.
