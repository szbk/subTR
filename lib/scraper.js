// turkcealtyazi.org scraper — arama + altyazı listesi parse.
//
// Akış:
//   1. search({ name, year }) → find.php'e istek
//   2. Sayfa film detayına yönlendiriyorsa → altyazı listesini parse et
//      Birden çok sonuç varsa → en iyi eşleşeni seç, onun sayfasını parse et
//   3. Her altyazı satırını (class'lar: underline, flagtr, alfps, alindirme,
//      ripdiv, alcd) structured JSON'a çevir

import * as cheerio from "cheerio";
import { fetchHtml, BASE_URL } from "./http.js";

/**
 * turkcealtyazi.org'da Türkçe altyazı ara.
 *
 * @param {object} params
 * @param {string} params.name — Film/dizi adı (zorunlu)
 * @param {number} [params.year] — Yapım yılı (opsiyonel, eşleşmeyi daraltır)
 * @param {string} [params.imdbId] — IMDB ID (örn "tt1375666"); name yerine geçer
 * @returns {Promise<Array<Subtitle>>} Altyazı nesneleri dizisi
 */
export async function search({ name, year, imdbId } = {}) {
  const query = imdbId || [name, year].filter(Boolean).join(" ");
  if (!query) return [];

  // 1) find.php'e istek — film/dizi sayfası linkini bul
  const searchUrl = `/find.php?find=${encodeURIComponent(query).replace(/%20/g, "+")}&cat=sub`;
  const html = await fetchHtml(searchUrl);
  const moviePageUrl = findMoviePageUrl(html, name);
  if (!moviePageUrl) return [];

  // 2) Film/dizi sayfasından altyazı listesini parse et
  const movieHtml = await fetchHtml(moviePageUrl);
  return parseSubtitleList(movieHtml);
}

/**
 * Search sonucu HTML'inden film/dizi sayfası linkini çıkarır.
 * find.php tek bir filme yönlendiriyorsa → o linki döndürür.
 * Birden çok sonuç varsa → isme en yakın olanı seçer.
 */
function findMoviePageUrl(html, name) {
  const $ = cheerio.load(html);
  const links = [];

  // Sadece site içi /mov/ veya /dizi/ linklerini topla.
  // Social share linkleri (facebook.com/share.php?u=...mov/...) ve
  // dış URL'leri filtrele — bunlar /mov/ içerir ama site içi değildir.
  $('a[href*="/mov/"], a[href*="/dizi/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    // Sadece relative path ("/mov/...") veya turkcealtyazi.org/mov/ kabul et.
    // facebook/twitter/google share linklerini reddet.
    if (href.includes("facebook.com") || href.includes("twitter.com") ||
        href.includes("google.com") || href.includes("wa.me") ||
        href.includes("tumblr.com") || href.includes("share")) {
      return;
    }
    // Relative path'e normalize et
    const normalized = href.startsWith("http") ? href.replace(/^https?:\/\/[^/]+/, "") : href;
    if (!links.includes(normalized)) links.push(normalized);
  });

  if (links.length === 0) return null;
  if (links.length === 1) return links[0];

  // Birden çok sonuç: isme en yakın olanı seç.
  // Slug eşleştirme: "i-love-boosters" ile "I Love Boosters" → "i-love-boosters"
  if (name) {
    const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    // Tam slug eşleşmesi ara
    let match = links.find((l) => decodeURIComponent(l).toLowerCase().includes(nameSlug));
    if (match) return match;
    // En uzun kelimeyle dene (tek harfli kelimeleri atla: "I", "A")
    const significantWords = name.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    for (const word of significantWords) {
      match = links.find((l) => decodeURIComponent(l).toLowerCase().includes(word));
      if (match) return match;
    }
  }
  return links[0];
}

/**
 * Film/dizi sayfası HTML'inden altyazı listesini parse eder.
 *
 * HTML yapısı (#altyazilar bölümü):
 *   .altyazi-list-wrapper > div (her satır)
 *     .underline a → href (/sub/ID/slug.html), title
 *     .flagtr → TR flag (varsa Türkçe)
 *     .alfps → FPS (23.976)
 *     .alindirme → indirme sayısı ("6,340")
 *     .ripdiv → release adı ("HDRINVASION" veya "WEB-DL / BluRay")
 *     .alcd → CD sayısı (film) veya sezon/bölüm (dizi)
 */
function parseSubtitleList(html) {
  const $ = cheerio.load(html);
  const results = [];

  // Dizi mi film mi? maintab kontrolü
  const isTvShow = $('[data-href="maintab"]').text().includes("Dizi");

  // #altyazilar içindeki her altyazı satırı
  const rows = $("#altyazilar .altyazi-list-wrapper > div, .altyazi-detay-list .altyazi-list-wrapper > div");

  rows.each((_, row) => {
    const $row = $(row);
    // İlk satır genelde başlık (Türkçe Altyazılar) — underline linki yoksa atla
    const $link = $row.find(".underline").first();
    if ($link.length === 0) return;

    const href = $link.attr("href") || "";
    const idMatch = href.match(/\/sub\/(\d+)\//);
    const id = idMatch ? idMatch[1] : null;
    if (!id) return;

    // Sadece Türkçe altyazılar (flagtr span varsa)
    const hasTrFlag = $row.find(".flagtr").length > 0;
    if (!hasTrFlag) return;

    const fps = cleanText($row.find(".alfps").first().text());
    const downloadsText = cleanText($row.find(".alindirme").first().text());
    const downloads = parseInt(downloadsText.replace(/[,.]/g, ""), 10) || 0;
    const release = cleanText($row.find(".ripdiv").first().text());

    // Release: "WEB-DL / BluRay" → birden çok release, "/" ile ayır
    const releases = release.split("/").map((r) => r.trim()).filter(Boolean);

    // CD (film) veya sezon/bölüm (dizi)
    let cd = null;
    let season = null;
    let episode = null;
    const cdText = cleanText($row.find(".alcd").first().text());
    if (cdText) {
      if (isTvShow) {
        // "Sezon 1 Bölüm 1" formatını yakala
        const sMatch = cdText.match(/(\d+)/g);
        if (sMatch && sMatch.length >= 2) {
          season = parseInt(sMatch[0], 10);
          episode = parseInt(sMatch[1], 10);
        } else if (sMatch && sMatch.length === 1) {
          season = parseInt(sMatch[0], 10);
        }
      } else {
        cd = parseInt(cdText, 10) || 1;
      }
    }

    const title = cleanText($row.find(".underline strong").text()) ||
                  cleanText($row.find(".underline").text());

    // Birden çok release varsa her biri için ayrı kayıt üret
    for (const rel of releases) {
      results.push({
        id,
        title,
        url: href,
        fps,
        release: rel,
        downloads,
        language: "tr",
        season,
        episode,
        cd,
      });
    }
  });

  // İndirme sayısına göre azalan sırala
  results.sort((a, b) => b.downloads - a.downloads);
  return results;
}

function cleanText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}
