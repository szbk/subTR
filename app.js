const getSubDetailsJSON = require('./subtr');

getSubDetailsJSON('Vikings', 2013, (err, res)=>{
  if(err){
    console.log(err);
  }
  else{
    console.log(res);
  }
});
