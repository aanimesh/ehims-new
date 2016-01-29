// server.js
// ---------
// Author: Amiel Kollek <a_kollek@live.ca>
//


var express  = require('express');
var http     = require('http');
var bodyParser = require('body-parser');
var io       = require('socket.io');

var routes  = require('./app/routes/routes.js');
var io_r    = require('./app/io/io.js');

var app  = express();
var http = http.Server(app);
var io   = io(http);

// Set up jade
app.set('views', './app/views');
app.set('view engine', 'jade');

// Serve bower components
app.use(express.static('bower_components'));

/**
 * Set up req.body for post requests
 */
// for parsing application/json
app.use(bodyParser.json()); 
// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// ---------------------------------

/**
 * Routes
 */
// landing page
app.get('/', routes.landing);

// list of channels, redirected to by landing
app.get('/channels', routes.channels);

// log on to a channel and chat
app.get('/channels/:channel/:username', routes.channel);

// ---------------------------------

/**
 * Websocket code
 */

io.on('connection',io_r.connection);

// Run server
http.listen(3000,function(){
    console.log('Listening on 3000');
});
