// HTTP yardımcı fonksiyonları — turkcealtyazi.org ile güvenli iletişim.
//
// Tasarım: dupe backend'inin (server/lib/metadata/tmdb.js) fetchWithRetry
// pattern'ini takip eder. Node 18+ native fetch kullanır (request paketi yok).
// Timeout (AbortController) + retry + User-Agent header.

const BASE_URL = "https://turkcealtyazi.org";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const RETRYABLE_ERRORS = new Set([
  "AbortError",
  "TypeError",
  "UND_ERR_CONNECT_TIMEOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
]);

/**
 * Verilen URL'i timeout ve retry ile fetch eder.
 * @param {string} url — Tam URL (https://...)
 * @param {object} [options] — fetch options (method, headers, body, ...)
 * @param {number} [timeoutMs=20000] — İstek timeout (ms)
 * @param {number} [retries=3] — Ağ hatasında yeniden deneme sayısı
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, timeoutMs = 20000, retries = 3) {
  const headers = {
    "User-Agent": USER_AGENT,
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    ...(options.headers || {}),
  };

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timer);
      return resp;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const errType = err?.name || err?.cause?.code || "Unknown";
      const isNetwork =
        RETRYABLE_ERRORS.has(errType) || (err?.message || "").includes("fetch failed");
      if (!isNetwork || attempt === retries) throw err;
      const delay = 1000 * (attempt + 1);
      console.warn(`⚠️ subTR ağ hatası (${errType}), ${delay}ms sonra yeniden denenecek (${attempt + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * Sayfa HTML'ini çeker (text olarak).
 * @param {string} pathOrUrl — "/sub/..." gibi path veya tam URL
 * @returns {Promise<string>} HTML içeriği
 */
export async function fetchHtml(pathOrUrl) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : BASE_URL + pathOrUrl;
  const resp = await fetchWithRetry(url);
  if (!resp.ok) {
    throw new Error(`turkcealtyazi.org isteği başarısız (${resp.status}): ${url}`);
  }
  // Site ISO-8859-9 (Windows-1254) dönebilir; header'dan charset'i algıla.
  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("8859") || contentType.includes("1254")) {
    const buf = Buffer.from(await resp.arrayBuffer());
    return decodeWindows1254(buf);
  }
  return await resp.text();
}

/**
 * Windows-1254 (Türkçe ISO-8859-9) buffer'ını UTF-8 string'e çevirir.
 * Node TextDecoder ISO-8859-9 desteklemez; manuel tablo kullanır.
 */
function decodeWindows1254(buf) {
  let result = "";
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    if (byte < 0x80) {
      result += String.fromCharCode(byte);
    } else if (byte === 0xD0) result += "\u011E"; // Ğ
    else if (byte === 0xDD) result += "\u0130"; // İ
    else if (byte === 0xDE) result += "\u015E"; // Ş
    else if (byte === 0xFE) result += "\u015F"; // ş
    else if (byte === 0xFD) result += "\u0131"; // ı
    else if (byte === 0xF0) result += "\u011F"; // ğ
    else if (byte === 0xC7) result += "\u00C7"; // Ç
    else if (byte === 0xE7) result += "\u00E7"; // ç
    else if (byte === 0xD6) result += "\u00D6"; // Ö
    else if (byte === 0xF6) result += "\u00F6"; // ö
    else if (byte === 0xDC) result += "\u00DC"; // Ü
    else if (byte === 0xFC) result += "\u00FC"; // ü
    else result += String.fromCharCode(byte);
  }
  return result;
}

export { BASE_URL, USER_AGENT };
