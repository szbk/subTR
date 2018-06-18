const cheerio = require('cheerio')
const request = require('request')

/**
* @method SubtitleDetailJSON
* @desc turkcealtyazi.org subtitle gets
* @param {string} nameOrImdb name or imdb number (require)
* @param {year} year Yıl yazılmalı, eğer imdb id ye göre aranacaksa yıl 0 verilmeli
* @returns {function} result async
*/

function SubtitleDetailJSON(data, cb){

  const nameOrImdb = data.nameOrImdb
  const year = data.year

  let generateURL;

  if(year){
    // Search by name and year
    generateURL =  'http://www.turkcealtyazi.org/find.php?find=' + nameOrImdb + '+' + year + '&cat=sub'
  }
  else{
    // Search by imdb
    generateURL =  'http://www.turkcealtyazi.org/find.php?find=' + nameOrImdb + '&cat=sub'
  }

  request(generateURL, (err, res, body)=>{

    if(err){
      const error = 'Sorun oluştu: ' + err
      const result = {'result': 0}
      cb(error, result)
    }
    else{
      const $ = cheerio.load(body, {
        normalizeWhitespace: true,
        xmlMode: true
      });

      // TR Flag
      var TotalTRSub = $('[class="flagtr"]').length;

      // Dönen Sonuç Var
      if(TotalTRSub > 0){

        const url = []
        // URL
        $('[class="underline"]').each(function(i, element){
          if(i < TotalTRSub){
            url.push($(this).attr('href'))
          }
        })

        const downloadRatio = []
        $('[class="alindirme"]').each(function(i, element){
          if(i > 0 && i <= TotalTRSub){

            const data = $(this).text().split(',')
            let downloadRatioData

            if(data[1]){
              downloadRatioData = data[0] + data[1]
            }
            else{
              downloadRatioData = data[0]
            }
            downloadRatio.push(downloadRatioData)
          }
        })

        const fps = []
        // FPS (ilk değer geçilecek.)
        $('[class="alfps"]').each(function(i, element){
          if(i > 0 && i <= TotalTRSub){
            fps.push($(this).text())
          }
        })

        const release = []
        // Release
        $('.ripdiv').each(function(i, element){

          if(i < TotalTRSub){

            let data = $(this).text().split('/')
            let new_data = []

            if(data.length > 1){
              for (var i = 0; i < data.length; i++) {
                new_data.push(data[i].trim())
              }
              release.push(new_data);
            }
            else{
              release.push(data[0].trim())
            }
          }
        })

        const movieOrTv = []
        // Movie && Dizi
        $('[class="alcd"]').each(function(i, element){
          if(i > 0 && i <= TotalTRSub){

            let data = $(this).text().split(' ')
            let new_data = {}
            data.shift()
            data.pop()

            // Dizi ise.
            if($('[data-href="maintab"]').text() == 'Dizi Detay'){

              if(data.length == 3){
                new_data = {
                  'season' : data[0],
                  'episode' : data[2]
                }
              }
              else{
                new_data = {
                  'season' : data[0],
                  'episode' : data[1]
                }
              }
            }
            // Film ise
            else{
              new_data = {
                'CD' : data[0],
              }
            }

            movieOrTv.push(new_data)

          }
        })

        let new_result = []
        let last_result = []

        for (var i = 0; i < TotalTRSub; i++) {
          new_result[i] = {
            'url' : url[i],
            'fps' : fps[i],
            'release' : release[i],
            'movieOrTv' : movieOrTv[i],
            'downloadRatio': downloadRatio[i]
          }
        }

        for (var i = 0; i < new_result.length; i++) {
          if(!Array.isArray(new_result[i].release)){
            last_result.push(new_result[i]);
          }
          else{

            for (var l = 0; l < new_result[i].release.length; l++) {
                last_result.push({
                'url' : new_result[i].url,
                'fps' : new_result[i].fps,
                'release' : new_result[i].release[l],
                'movieOrTv' : new_result[i].movieOrTv,
                'downloadRatio' : new_result[i].downloadRatio,
              })
            }
          }
        }

        const error = false
        cb(error, last_result)
      }
      // Dönen Sonuç Yok
      else{
        const error = false
        const result = {'result': 0}
        cb(error, result)
      }
    }
  })
}

module.exports = SubtitleDetailJSON
