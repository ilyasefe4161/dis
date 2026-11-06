# Günsoy Ağız ve Diş Sağlığı Polikliniği — web sitesi

Tek sayfa, build adımı yok. Statik HTML + CSS + vanilla JS; klasörü Vercel'e atınca çalışır.

```
index.html
css/style.css
js/main.js
media/            ← sitede kullanılan videolar + poster kareleri
raw/              ← Flow'dan gelen ham dosyalar (yayına gerek yok, arşiv)
scripts/video-ekle.sh
```

Çalıştırmak için:

```bash
python3 -m http.server 4321
```

> `file://` ile açma — video seek'i yalnızca http üzerinden düzgün çalışır.

---

## 1. ÖNCE BUNLARI TEYİT ET

Site, internette bulunabilen tek bir dizin kaydından alınan bilgilerle dolduruldu.
Kliniğe göstermeden önce şunları doğrula:

| Bilgi | Sitedeki değer | Durum |
|---|---|---|
| Ad | Günsoy Ağız ve Diş Sağlığı Polikliniği | Kayıttan |
| Adres | Cedit Mah. Turan Güneş Cd. No: 10/A, 41900 İzmit / Kocaeli | Kayıttan |
| Telefon | (0262) 422 22 41 | Kayıttan |
| Online randevu | `uygulama.dentalbulut.com/.../gunsoy-agiz-ve-dis-sagligi-poliklinigi` | Kayıttan |
| **Çalışma saatleri** | Hafta içi 09:00–19:00, Cmt 09:00–14:00, Pazar kapalı | **VARSAYIM — mutlaka sor** |
| **Hasta yorumları** | Yer tutucu metinler | **Gerçek Google yorumlarıyla değiştir** |
| Hekim kadrosu | Sitede yok | İsim/ünvan alınca bir "Ekibimiz" bölümü eklenebilir |

Kaynak: wowturkey.com üzerindeki kullanıcı kaydı. Klinik tarafından doğrulanmış
bir kaynak değil.

**Çalışma saatleri tek yerden yönetiliyor:** `js/main.js` en üstteki `HOURS` sabiti
(0 = Pazar). Hero'daki "şu anda açığız / yarın 09:00'da açığız" rozeti bunu kullanıyor.
`index.html` içinde iki yerde daha saatler yazılı (bilgi şeridi ve iletişim) — üçünü
birlikte güncelle.

**Hasta yorumları** bölümü bilerek "Örnek yerleşim" rozetiyle işaretlendi. Gerçek
yorumlar gelmeden kliniğe gösterirken bu rozet dürüst duruyor; yorumlar girilince
rozeti ve açıklama paragrafını sil.

---

## 2. Tasarım yönü

Palet doğrudan klinik iç mekânı videosundan alındı: sıcak meşe, adaçayı yeşili,
kırık beyaz. Koyu renk yalnızca klinik bandında ve iletişim bölümünde kullanılıyor.

| Değişken | Renk | Kullanım |
|---|---|---|
| `--paper` | `#FBF9F5` | Ana zemin |
| `--ink` | `#16261F` | Metin, koyu bölümler |
| `--sage` | `#5C7A66` | Birincil — butonlar, ikonlar, vurgular |
| `--sage-l` | `#E3EDE3` | İkon kutuları, etiketler |
| `--sand-l` | `#F6EFE2` | Tedaviler bölümü zemini |
| `--coral` | `#D47A58` | Yalnızca yıldızlar ve "kapalı" rozeti |

Tipografi: tek aile — **Plus Jakarta Sans**. Başlıklar 600, sıkı harf aralığı.

---

## 3. Videolar

| Dosya | Nerede | Davranış |
|---|---|---|
| `01-hero.mp4` | Hero kartı | Scroll ile diş dönüyor |
| `02-ark.mp4` | Yaklaşımımız | Scroll ile dişler kemere diziliyor |
| `03-beyazlatma.mp4` | Beyazlatma | Scroll ile diş beyazlıyor, ton skalası takip ediyor |
| `04-implant.mp4` | İmplantoloji | Scroll ile implant yerleşiyor + anatomi noktaları |
| `05-ortodonti.mp4` | Ortodonti | Scroll ile şeffaf plak dişlere oturuyor |
| `06-lamine.mp4` | Tedaviler kartı | Döngüde oynuyor |
| `07-klinik.mp4` | Klinik bandı | Tam genişlik, döngüde, üstünde koyu degrade |
| `09-cocuk.mp4` | Çocuk bölümü | Döngüde oynuyor |
| `08-mine.mp4` | Henüz kullanılmıyor | Bölüm arası doku olarak eklenebilir |

Yeni video eklemek:

```bash
./scripts/video-ekle.sh ~/Downloads/Yeni_Video.mp4 10-ad
```

---

## 4. Nasıl çalışıyor

**Akışkan scroll.** `Smooth` sınıfı tekerlek girdisini alıp gerçek scroll pozisyonunu
yumuşatarak ilerletiyor (`window.scrollTo`, transform değil) — böylece `position:sticky`
olduğu gibi çalışıyor. Klavye, scrollbar sürükleme ve sayfa içi arama algılanıp hedef
yeniden senkronlanıyor. Dokunmatik cihazlarda ve `prefers-reduced-motion` açıkken kapalı.

**Scroll-scrub.** `Scrub` sınıfı bölümün ekrandaki konumundan 0–1 ilerleme hesaplayıp
`video.currentTime`'ı oraya taşıyor. Videolar `-g 1` ile encode edildiği için
(her kare keyframe) ileri-geri sarma takılmıyor. Bölümün `style="height:…vh"` değeri
animasyonun kaç ekran boyunca süreceğini belirler.

**Anatomi noktaları.** İmplant bölümünde animasyon %88'i geçince (`.hots-on`) dört nokta
beliriyor; tıklayınca (masaüstünde ayrıca hover) kartın altındaki tek panel güncelleniyor.
Noktaların `--x` / `--y` yüzdeleri videonun gerçek kare içeriğinden ölçüldü — videoyu
değiştirirsen yeniden ayarla.

**Video kartları.** Videoların kendi stüdyo arka planı `--plate` degradesiyle
eşleştirildi; harmanlama (`mix-blend-mode`) numarasına gerek kalmadı. Kartın yuvarlak
kenarı bilinçli bir tasarım öğesi.

**iOS.** Videolar `playsinline muted preload=auto`; ilk dokunuşta bir kez
`play()/pause()` yapılarak seek kilidi açılıyor.

---

## 5. Yayına almadan önce

- [ ] Çalışma saatlerini ve yorumları doğrula (yukarıdaki tablo)
- [ ] Randevu formu şu an sadece ekranda "alındı" diyor, hiçbir yere göndermiyor.
      Formspree / Vercel serverless / WhatsApp linkinden biri bağlanmalı.
      (Online randevu butonları zaten kliniğin gerçek dentalbulut sayfasına gidiyor.)
- [ ] `raw/` klasörü için `.vercelignore` ekle
- [ ] Favicon ve OG görseli
- [ ] KVKK aydınlatma metni ve çerez bildirimi
- [ ] Sağlık Bakanlığı tanıtım yönetmeliği: hasta yorumu yayınlama ve "en iyi",
      "garantili" gibi ifadeler konusunda kısıtlar var — metinler bu gözle okunmalı
