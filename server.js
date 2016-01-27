// server.js
// ---------
// Author: Amiel Kollek <a_kollek@live.ca>
//


var express  = require('express');
var http     = require('http');
var bodyParser = require('body-parser');

var routes  = require('./app/routes/routes.js');

var app = express();
var http = http.Server(app);
// set up jade
app.set('views', './app/views');
app.set('view engine', 'jade');

// serve bower components
app.use(express.static('bower_components'));

// set up req.body for post requests
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// landing page
app.get('/', routes.landing);

// list of channels, redirected to by landing
app.get('/channels', routes.channels);

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
