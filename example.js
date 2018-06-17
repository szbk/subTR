const getSubDetailsJSON = require('./index');

getSubDetailsJSON('Vikings', 2013, (err, res)=>{
  if(err){
    console.log(err);
  }
  else{
    console.log(res);
  }
});
