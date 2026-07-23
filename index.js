// subTR — turkcealtyazi.org unofficial API
//
// Export edilen fonksiyonlar:
//   search({ name, year, imdbId }) → Promise<Subtitle[]>
//   download(subtitleId, subtitleUrl?) → Promise<{ srt, fileName }>
//
// Örnek kullanım:
//   import { search, download } from "subtr";
//   const subs = await search({ name: "Inception", year: 2010 });
//   const { srt } = await download(subs[0].id, subs[0].url);

export { search } from "./lib/scraper.js";
export { download } from "./lib/download.js";
