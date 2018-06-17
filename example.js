const SubtitleDetailJSON = require('./index');

SubtitleDetailJSON({
  nameOrImdb: 'The.End.Of.The.F***ing.World',
  year: 2017
},(err, res)=>{
  if(err){
    console.log(err);
  }
  else{
    console.log(res);
  }
});
