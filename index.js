var app  = require('express')();
var http = require('http').Server(app);

// set up jade
app.set('views', './views');
app.set('view engine', 'jade');

// landing page
app.get('/',function(req, res){
    // page to join a channel
    res.render("landing");
    }
);

app.get('/channels',function(req, res){
    // list of channels, redirected to by landing
    }
);

app.get('

// Run server
http.listen(3000,function(){
    console.log('Listening on 3000');
});
