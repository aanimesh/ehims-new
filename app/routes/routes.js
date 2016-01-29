// routes.js
// ---------
// Author: Amiel Kollek <a_kollek@live.ca>
//

var storage = require('../models/storage.js');

var landing_r = function(req, res){
    res.render("welcome");
};

var channels_r = function(req, res){
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

var channel_r = function(req, res){
    var context = { user: req.params.username,
                channel: req.params.channel};
    storage.get_or_create_user(context.user,function(results){
        var user = results;
        storage.join_or_create_channel(user, context.channel, function(results){
            var channel = results.channel;
            storage.get_messages_by_channel(channel._id,function(results){
                context.messages = results;
                storage.get_users(channel.online_users,function(results){
                    context.online = results;
                    res.render("channel", context);
                });
            });
        });
    });
};


exports.landing = landing_r;
exports.channels = channels_r;
exports.channel = channel_r;
