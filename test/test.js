// subTR canlı test — turkcealtyazi.org üzerinde gerçek istekler.
//
// Çalıştırma: npm test
//
// Test senaryoları:
//   1. Film arama (Inception 2010) → ≥3 sonuç, film fields
//   2. Dizi arama (The Walking Dead) → sezon/bölüm bilgili sonuçlar
//   3. Olmayan film → boş array, crash yok
//   4. Download → UTF-8 SRT, Türkçe karakterler düzgün

import { search, download } from "../index.js";

const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const INFO = "\x1b[36mℹ\x1b[0m";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ${PASS} ${message}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${message}`);
    failed++;
  }
}

async function testFilmSearch() {
  console.log("\n📋 Test 1: Film arama (Inception 2010)");
  try {
    const subs = await search({ name: "Inception", year: 2010 });
    assert(subs.length >= 3, `≥3 altyazı bulundu (bulunan: ${subs.length})`);
    if (subs.length > 0) {
      const s = subs[0];
      assert(typeof s.id === "string" && s.id.length > 0, `id var: "${s.id}"`);
      assert(typeof s.url === "string" && s.url.includes("/sub/"), `url /sub/ içeriyor: "${s.url}"`);
      assert(typeof s.release === "string" && s.release.length > 0, `release var: "${s.release}"`);
      assert(s.language === "tr", `language "tr": "${s.language}"`);
      assert(s.season === null, `film → season null: ${s.season}`);
      assert(typeof s.downloads === "number", `downloads sayı: ${s.downloads}`);
      console.log(`  ${INFO} En popüler: ${s.release} (${s.downloads} indirme, ${s.fps} fps)`);
      return subs;
    }
  } catch (err) {
    assert(false, `Hata fırlatmamalı: ${err.message}`);
  }
  return [];
}

async function testTvSearch() {
  console.log("\n📋 Test 2: Dizi arama (The Walking Dead)");
  try {
    const subs = await search({ name: "The Walking Dead", year: 2010 });
    assert(subs.length > 0, `Sonuç bulundu (bulunan: ${subs.length})`);
    // Dizilerde en az birinde season bilgisi olmalı
    const withSeason = subs.filter((s) => s.season !== null);
    assert(withSeason.length > 0, `Sezon bilgili altyazı var: ${withSeason.length} adet`);
    if (withSeason.length > 0) {
      const s = withSeason[0];
      console.log(`  ${INFO} Örnek: S${s.season}E${s.episode} — ${s.release}`);
    }
  } catch (err) {
    assert(false, `Hata fırlatmamalı: ${err.message}`);
  }
}

async function testNonExistent() {
  console.log("\n📋 Test 3: Olmayan film (XyzNonExistent123)");
  try {
    const subs = await search({ name: "XyzNonExistent123456789", year: 1900 });
    assert(Array.isArray(subs), "Array dönmeli");
    assert(subs.length === 0, `Boş array (bulunan: ${subs.length})`);
  } catch (err) {
    assert(false, `Hata fırlatmamalı (crash yok): ${err.message}`);
  }
}

async function testDownload(subs) {
  console.log("\n📋 Test 4: Download (Inception ilk altyazı)");
  if (subs.length === 0) {
    console.log(`  ${INFO} Atlandı (altyazı bulunamadı)`);
    return;
  }
  try {
    const { srt, fileName } = await download(subs[0].id, subs[0].url);
    assert(typeof srt === "string" && srt.length > 100, `SRT içeriği var (${srt.length} char)`);
    assert(typeof fileName === "string" && fileName.endsWith(".srt"), `dosya adı .srt: "${fileName}"`);
    // SRT formatı kontrolü
    assert(srt.includes(" --> "), "Zaman damgası var (SRT formatı)");
    // Türkçe karakter kontrolü — UTF-8 decode düzgün mü
    const hasTurkish = /[şğİıöçüŞĞ]/.test(srt);
    console.log(`  ${INFO} Türkçe karakter ${hasTurkish ? "bulundu (UTF-8 OK)" : "yok (içerik İngilizce olabilir)"}`);
    // İlk 3 satırı göster
    const preview = srt.split("\n").slice(0, 5).join("\n");
    console.log(`  ${INFO} Önizleme:\n    ${preview.split("\n").join("\n    ")}`);
  } catch (err) {
    assert(false, `İndirme hatası: ${err.message}`);
  }
}

// Ana test akışı
console.log("🧪 subTR canlı test başlıyor...\n");

const subs = await testFilmSearch();
await testTvSearch();
await testNonExistent();
await testDownload(subs);

console.log(`\n${"=".repeat(40)}`);
console.log(`Sonuç: ${passed} geçti, ${failed} başarısız`);
process.exit(failed > 0 ? 1 : 0);
