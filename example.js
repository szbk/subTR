const SubtitleDetailJSON = require('./index');
const _ = require('lodash')

SubtitleDetailJSON({
  nameOrImdb: 'The Walking Dead',
  year: 2010
},(err, res)=>{
  if(err){
    console.log(err);
  }
  else{

      const searchRelease = ''
      const searchFPS = '23.976'
      const season = 'S09'
      const episode = 'E01'

      const result =  _.filter(res, {'fps':searchFPS, 'release': searchRelease, movieOrTv: { 'episode': episode} })
      console.log(result);
      console.log(_.maxBy(result, 'downloadRatio'));
  }
});
