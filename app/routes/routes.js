// routes.js
// ---------
// Author: Amiel Kollek <a_kollek@live.ca>
//

var storage = require('../models/storage.js');

module.exports = function(io){

    routes = {
       landing : function(req, res){
           res.render("welcome");
       },
       
       channels : function(req, res){
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
       
       },
       
        channel : function(req, res){
           var context = { user: req.params.username,
                       channel: req.params.channel};
           storage.get_or_create_user(context.user,function(results){
               var user = results;
               context.user = user;
               storage.join_or_create_channel(user, context.channel,function(results){
                   var channel = results.channel;
                   context.channel = channel;
                   storage.get_messages_by_channel(channel.name,function(results){
                       context.messages = results;
                       storage.get_usernames(channel.online_users,function(results){
                           context.online = results;
                           res.render("channel", context);
                       });
                   });
               });
           });
       },
       
        message : function(req, res){
           storage.create_message(req.body,function(message){
               io.to(req.body.channel).emit('message',message);
               res.send('Message sent');
           });
       },
    
    };

    return routes;
};

