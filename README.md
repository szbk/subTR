# subTR

**turkcealtyazi.org** için unofficial API — Türkçe altyazı arama ve indirme.

Modern,Promise,ES Modules. Node 18+ native `fetch` kullanır (deprecated `request` paketi yok).

## Kurulum

```bash
npm install
```

## Kullanım

```js
import { search, download } from "subtr";

// 1. Altyazı ara
const subs = await search({ name: "Inception", year: 2010 });
console.log(subs[0]);
// {
//   id: "746685",
//   title: "Inception",
//   url: "/sub/746685/inception1.html",
//   fps: "23.976",
//   release: "HDRINVASION",
//   downloads: 6340,
//   language: "tr",
//   season: null,
//   episode: null,
//   cd: 1
// }

// 2. Altyazı indir
const { srt, fileName } = await download(subs[0].id, subs[0].url);
fs.writeFileSync("Inception.tr.srt", srt, "utf8");
```

## API

### `search({ name, year, imdbId })` → `Promise<Subtitle[]>`

turkcealtyazi.org'da Türkçe altyazı arar.

| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `name` | `string` | Film/dizi adı (zorunlu, `imdbId` yoksa) |
| `year` | `number` | Yapım yılı (opsiyonel, eşleşmeyi daraltır) |
| `imdbId` | `string` | IMDB ID (örn `"tt1375666"`); `name` yerine geçer |

**Dönüş:** Altyazı nesneleri dizisi (indirme sayısına göre azalan sıralı).

### `download(subtitleId, subtitleUrl?)` → `Promise<{ srt, fileName }>`

Altyazıyı indirir ve UTF-8 SRT olarak döner.

| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `subtitleId` | `string` | Altyazı ID (örn `"746685"`) |
| `subtitleUrl` | `string` | `/sub/ID/slug.html` URL (opsiyonel, hız için) |

**Dönüş:** `{ srt: string (UTF-8), fileName: string }`

ZIP'ten SRT çıkarılır, ISO-8859-9 (Windows-1254) encoding UTF-8'e çevrilir.

## Özellikler

- ✅ Türkçe altyazı arama (film + dizi)
- ✅ Release + FPS bilgisi (OpenSubtitles'ta yok)
- ✅ Dizi sezon/bölüm ayrıştırma
- ✅ Altyazı indirme (ZIP → UTF-8 SRT)
- ✅ Timeout + retry (ağ hatalarına dayanıklı)
- ✅ HTTPS (HTTP yönlendirmesi otomatik takip)
- ✅ Windows-1254 (ISO-8859-9) → UTF-8 encoding dönüşümü
- ✅ Social share link filtreleme (site içi /mov/ linklerini ayırt eder)
- ✅ Yıl bazlı doğru film seçimi (aynı isimli filmler arasında yıl ile daraltma)
- ✅ Tam slug eşleştirme ("obsession" ≠ "a-teachers-obsession")

## Test

```bash
npm test
```

### Doğrulanmış test sonuçları

| Film/Dizi | Altyazı | Download | UTF-8 |
|-----------|---------|----------|-------|
| Inception (2010) | 54 sonuç | ✅ | ✅ |
| The Walking Dead (2010) | 201 sonuç (sezon/bölüm) | ✅ | ✅ |
| Mission Impossible: Final Reckoning (2025) | 47 sonuç | ✅ | ✅ |
| Obsession (2025) | 2 sonuç (yıl bazlı doğru film) | ✅ | ✅ |
| I Love Boosters (2026) | 0 (altyazı yok, doğru) | — | — |
| Olmayan film | 0 (crash yok) | — | — |

Örnek download çıktısı (Mission Impossible):
```
Dosya: gfp1-tcr-720p-illsn.srt
Boyut: 103,812 karakter
UTF-8 Türkçe: EVET

1
00:01:16,827 --> 00:01:19,626
Amerika'ya inanıyorum.

2
00:01:19,705 --> 00:01:22,709
Benim talihim Amerika'da döndü.
```

## Süreç (adım adım)

```
search({ name, year })
  │
  ├─ 1. GET find.php?find={name}+{year}&cat=sub
  ├─ 2. HTML'den /mov/ veya /dizi/ linkini bul:
  │     • Social share linkleri filtrele (facebook/google/twitter)
  │     • Tam slug eşleşmesi (obsession ≠ a-teachers-obsession)
  │     • Yıl ile daraltma (2025 belirten link tercih edilir)
  │     • En yüksek ID'li film (yeni çıkanlar) seçilir
  ├─ 3. Film/dizi sayfasını çek
  └─ 4. #altyazilar satırlarını parse et (.underline, .flagtr, .alfps, .ripdiv)
       → indirme sayısına göre sıralı JSON dizisi

download(subtitleId, subtitleUrl)
  │
  ├─ 1. GET /sub/{id}/{slug}.html → detay sayfası
  ├─ 2. Form token'larını çek (idid, altid, sidid)
  ├─ 3. POST /ind → ZIP dosyası
  └─ 4. ZIP'ten SRT çıkar → ISO-8859-9 → UTF-8 çevir
```

## Lisans

MIT
