// routes.js
// ---------
// Author: Amiel Kollek <a_kollek@live.ca>
//

var storage = require('../models/storage.js');

var get_socket_url = function(){
    return process.env.NODE_ENV ? 'https://ehims-new.herokuapp.com/' : 'http://localhost:3000/';
};

var join_channel = function(context, res){
    return function(results){
     var channel = results.channel;
     context.channel = channel;
     storage.get_messages_by_channel(channel._id, function(results){
         context.messages = results;
         var message_keys = Object.keys(results);
         var queue = [];
         for(var i = 0, len = message_keys.length;i<len;i++){
              queue.push(context.messages[message_keys[i]]);
         }
         queue.sort(function(a,b){
             return new Date(a.created_at) - new Date(b.created_at);
         });
         context.queue = queue;
         console.log("Connected Users");
         console.log(channel.online_users);
         storage.get_usernames(channel.online_users,function(results){
             context.online = results;
             res.render("channel", context);
         });
     });
};};

module.exports = function(io){

    routes = {
       landing : function(req, res){
           res.render("welcome");
       },
       
       channels : function(req, res){
           var user = req.body.username;
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
            var socket_url = get_socket_url();
            var context = { user: req.body.username,
                channel: req.body.channel,
                ctype: req.body.ctype,
                socket_url : socket_url};
            storage.get_or_create_user(context.user,function(results){
                var user = results;
                context.user = user;
                storage.join_or_create_channel(user, context.channel, context.ctype,
                    join_channel(context, res));
            });
        },
       
        message : function(req, res){
           storage.create_message(req.body,function(message){
               io.to(req.body.channel).emit('message',message);
               res.send('Message sent');
           });
        },

        channel_redirect : function(req, res) {
            console.log("Redirect: "+req.body);
            var socket_url = get_socket_url();
            var context = { user: req.query.username,
                channel: req.query.channel,
                socket_url : socket_url};
            if(!context.user) {
                res.status(400);
                res.send('Bad Request');
            }
            storage.get_or_create_user(context.user,function(results){
                var user = results;
                context.user = user;
                console.log("Created user");
                storage.join_channel(user, context.channel, 
                    join_channel(context, res));
            });

        },

    
    };

    return routes;
};

