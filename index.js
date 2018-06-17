const cheerio = require('cheerio')
const request = require('request')

/**
* @method getSubDetailsJSON
* @desc turkcealtyazi.org subtitle gets
* @param {string} nameOrImdb name or imdb number (require)
* @param {year} year Yıl yazılmalı, eğer imdb id ye göre aranacaksa yıl 0 verilmeli
* @returns {function} result async
*/

function getSubDetailsJSON(nameOrImdb, year, cb){

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

        for (var i = 0; i < TotalTRSub; i++) {
          new_result[i] = {
            'url' : url[i],
            'fps' : fps[i],
            'release' : release[i],
            'movieOrTv' : movieOrTv[i]
          }
        }

        const error = false
        cb(error, new_result)
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

module.exports = getSubDetailsJSON
