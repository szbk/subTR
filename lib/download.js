// turkcealtyazi.org altyazı indirme.
//
// Akış:
//   1. GET /sub/{id}/{slug}.html → detay sayfası HTML'i
//   2. HTML'den download token'ları parse et (idid, altid, sidid)
//   3. POST /ind (form-data) → ZIP dosyası
//   4. ZIP'ten SRT çıkar, UTF-8'e çevir
//
// Önemli: sidid session token'dır — her detay sayfasında farklı olabilir,
// bu yüzden download() önce detay sayfasını ziyaret edip token'ı çeker.

import * as cheerio from "cheerio";
import { fetchWithRetry, fetchHtml, BASE_URL, USER_AGENT } from "./http.js";
import zlib from "zlib";

/**
 * Bir altyazıyı indir.
 * @param {string} subtitleId — Altyazı ID (örn "746685")
 * @param {string} [subtitleUrl] — /sub/ID/slug.html URL (opsiyonel, hız için)
 * @returns {Promise<{ srt: string, fileName: string }>} UTF-8 SRT içeriği
 */
export async function download(subtitleId, subtitleUrl) {
  // 1) Detay sayfası URL'ini belirle
  const detailUrl = subtitleUrl || `/sub/${subtitleId}/`;

  // 2) Detay sayfasından download token'larını çek
  const html = await fetchHtml(detailUrl);
  const tokens = parseDownloadTokens(html, subtitleId);
  if (!tokens) {
    throw new Error(`Download token'ları bulunamadı (altyazı: ${subtitleId}). Sayfa yapısı değişmiş olabilir.`);
  }

  // 3) POST /ind → ZIP dosyası
  const formData = new URLSearchParams();
  formData.set("idid", tokens.idid);
  formData.set("altid", tokens.altid);
  formData.set("sidid", tokens.sidid);

  const resp = await fetchWithRetry(`${BASE_URL}/ind`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: BASE_URL + detailUrl,
      Origin: BASE_URL,
    },
    body: formData.toString(),
  });

  if (!resp.ok) {
    throw new Error(`İndirme başarısız (HTTP ${resp.status})`);
  }

  // 4) ZIP'i buffer olarak al, SRT çıkar
  const zipBuffer = Buffer.from(await resp.arrayBuffer());
  const extracted = extractSrtFromZip(zipBuffer);
  if (!extracted) {
    throw new Error("ZIP içinde SRT dosyası bulunamadı");
  }

  return extracted;
}

/**
 * Detay sayfası HTML'inden download form token'larını çıkarır.
 * Form yapısı: <form action="/ind"> <input name="idid"> <input name="altid"> <input name="sidid">
 */
function parseDownloadTokens(html, subtitleId) {
  const $ = cheerio.load(html);

  // action="/ind" olan formu bul
  const $form = $('form[action="/ind"]').first();
  if ($form.length === 0) return null;

  const idid = $form.find('input[name="idid"]').attr("value");
  const altid = $form.find('input[name="altid"]').attr("value");
  const sidid = $form.find('input[name="sidid"]').attr("value");

  if (!altid || !sidid) return null;
  // idid bazen olmayabilir, altid ile aynı olabilir
  return {
    idid: idid || altid,
    altid,
    sidid,
  };
}

/**
 * ZIP buffer'ından SRT içeriğini çıkarır.
 * turkcealtyazi.org ZIP'leri genelde tek SRT içerir.
 * ZIP formatı manuel parse edilir (zlib kullanmadan — deflate).
 * @returns {{ srt: string, fileName: string } | null}
 */
function extractSrtFromZip(zipBuffer) {
  // ZIP formatı: her dosya için local file header (PK\x03\x04)
  // En basit yaklaşım: Node'un yarı-gerçek desteği yok, manuel parse.
  // PK\x03\x04 imzasını ara, dosya adını ve compressed datayı çıkar.
  let offset = 0;
  while (offset < zipBuffer.length - 4) {
    // Local file header signature: 0x04034b50 (PK\x03\x04 little-endian)
    if (zipBuffer[offset] === 0x50 && zipBuffer[offset + 1] === 0x4b &&
        zipBuffer[offset + 2] === 0x03 && zipBuffer[offset + 3] === 0x04) {
      const result = parseZipEntry(zipBuffer, offset);
      if (result) return result;
      // Sonraki entry'e geç
      offset = result?.nextOffset || offset + 4;
    } else {
      offset++;
    }
  }
  return null;
}

/**
 * Tek bir ZIP local file header'ını parse eder.
 * Sadece deflate (method 8) ve store (method 0) destekler.
 */
function parseZipEntry(buf, headerOffset) {
  // Local file header yapısı (ZIP spec):
  //   0  signature (4)
  //   4  version needed (2)
  //   6  flags (2)
  //   8  compression method (2)
  //  10  mod time (2)
  //  12  mod date (2)
  //  14  CRC-32 (4)
  //  18  compressed size (4)
  //  22  uncompressed size (4)
  //  26  filename length (2)
  //  28  extra field length (2)
  //  30  filename
  //  ... extra field
  //  ... file data

  const compressionMethod = buf.readUInt16LE(headerOffset + 8);
  const compressedSize = buf.readUInt32LE(headerOffset + 18);
  const uncompressedSize = buf.readUInt32LE(headerOffset + 22);
  const filenameLen = buf.readUInt16LE(headerOffset + 26);
  const extraLen = buf.readUInt16LE(headerOffset + 28);

  const filenameStart = headerOffset + 30;
  const fileName = buf.slice(filenameStart, filenameStart + filenameLen).toString("latin1");

  const dataStart = filenameStart + filenameLen + extraLen;
  const compressedData = buf.slice(dataStart, dataStart + compressedSize);

  // Sadece .srt dosyalarını işle
  if (!fileName.toLowerCase().endsWith(".srt")) {
    return { nextOffset: dataStart + compressedSize, srt: null, fileName: null };
  }

  let fileBuffer;
  if (compressionMethod === 0) {
    // Store (no compression)
    fileBuffer = compressedData;
  } else if (compressionMethod === 8) {
    // Deflate — zlib raw inflate
    fileBuffer = inflateRaw(compressedData);
  } else {
    return { nextOffset: dataStart + compressedSize, srt: null, fileName: null };
  }

  if (!fileBuffer) return null;

  // SRT'yi UTF-8'e çevir (ISO-8859-9/Windows-1254 olabilir)
  const srt = decodeSubtitle(fileBuffer);
  return { srt, fileName, nextOffset: dataStart + compressedSize };
}

/**
 * Raw deflate decompression (zlib).
 */
function inflateRaw(data) {
  try {
    return zlib.inflateRawSync(data);
  } catch {
    return null;
  }
}

/**
 * Subtitle buffer'ını UTF-8 string'e çevirir.
 * Önce UTF-8 dener, başarısız olursa ISO-8859-9 (Türkçe Windows-1254) kullanır.
 */
function decodeSubtitle(buf) {
  // UTF-8 BOM varsa direkt UTF-8
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString("utf8");
  }
  // UTF-8 geçerli mi kontrol et
  try {
    const text = buf.toString("utf8");
    // UTF-8 decode hatası karakteri (U+FFFD) varsa → Windows-1254 dene
    if (!text.includes("\uFFFD")) return text;
  } catch {}
  // Windows-1254 / ISO-8859-9 decode
  return buf.toString("binary").replace(/[\u00C0-\u00FF]/g, (ch) => {
    const code = ch.charCodeAt(0);
    const map = {
      0xD0: "\u011E", 0xDD: "\u0130", 0xDE: "\u015E", 0xFE: "\u015F",
      0xFD: "\u0131", 0xF0: "\u011F", 0xC7: "\u00C7", 0xE7: "\u00E7",
      0xD6: "\u00D6", 0xF6: "\u00F6", 0xDC: "\u00DC", 0xFC: "\u00FC",
    };
    return map[code] || ch;
  });
}
