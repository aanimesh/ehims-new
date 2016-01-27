// routes.js
// ---------
// Author: Amiel Kollek <a_kollek@live.ca>
//

var storage = require('../models/storage.js');

var landing = function(req, res){
    res.render("welcome");
};

var channels = function(req, res){
    var user = req.query.username;
    var channels;

    // first get the user
    storage.get_or_create_user(user,function(results){
        user = results;
        // then get all the channels
        storage.get_channels(function(results){
            channels = results;
            res.render("channels",{ user: user, channels: channels});
        });
    });

};

//var channel = function(req, res){


exports.landing = landing;
exports.channels = channels;
