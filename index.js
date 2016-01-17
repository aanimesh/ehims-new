var express  = require('express');
var http     = require('http');
var bodyParser = require('body-parser');
var storage  = require('./storage.js');

var app = express();
var http = http.Server(app);
// set up jade
app.set('views', './views');
app.set('view engine', 'jade');

// serve bower components
app.use(express.static('bower_components'));

// set up req.body for post requests
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// landing page
app.get('/',function(req, res){
    // page to join a channel
    res.render("welcome");
    }
);

app.get('/channels',function(req, res){
    // list of channels, redirected to by landing
    
    var render = function(user){
        res.render("channels",{ user: user });
    };

    // get the user document, then render the page
    storage.get_or_create_user(req.query.username,render);
    }
);

app.get('/^channels/:channel/:username', function(req, res){
    // join and open the channel
    // if username and channel exist
    // otherwise 404
    }
);

// Run server
http.listen(3000,function(){
    console.log('Listening on 3000');
});
