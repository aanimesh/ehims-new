// server.js
// ---------
// Author: Amiel Kollek <a_kollek@live.ca>
//


var express  = require('express');
var http     = require('http');
var bodyParser = require('body-parser');
var io       = require('socket.io');

var app  = express();
var http = http.Server(app);
var io   = io(http);

var routes  = require('./app/routes/routes.js')(io);
var io_r    = require('./app/io/io.js')(io);

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
app.post('/channels', routes.channels);

app.post('/join', routes.join_channel);

app.post('/create', routes.create_channel);

// send a message
app.post('/message',routes.message);

// download messages for a channel
app.get('/download', routes.download_channel);

app.get('/admin', routes.admin_login);

app.post('/admin', routes.admin);

app.post('/makeinvite', routes.make_invite);

app.get('/invite', routes.invite_login);

app.post('/invite', routes.invite);

// ---------------------------------

/**
 * Websocket code
 */

io.on('connection',io_r.connection);

var port = process.env.PORT || 3000;

// Run server
http.listen(port,function(){
    console.log('Listening on 3000');
});
