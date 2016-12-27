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
     channel.log_user_in(context.user);
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
               res.render("channels",{ user: user});
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

        download_channel : function(req, res) {
            try{
            var channel = req.query.channel;
            console.log("Channel download: " + channel);
            if(channel === 'all'){
                storage.get_all_channels(function(channels){
                    storage.get_all_messages(function(messages){
                        ret = {'channels': []};
                        channels.forEach(function(ch){
                            ret.channels.push({
                                'channel_id': ch._id,
                                'chat_type': ch.chat_type,
                                'name': ch.name,
                                'messages': messages.filter(function(m){
                                    return m.channel.equals(ch._id);
                                    }),
                            });
                        });
                        res.json(ret);
                    });
                });
            }
            else {
                storage.get_channel_by_id(channel, function(ch) {
                    if(ch === null || ch === undefined) 
                        res.status(400).json({'error': 'Bad request'});
                    storage.get_messages_by_channel(channel, function(messages) {
                        if(messages === null || messages === undefined) 
                            res.status(400).json({'error': 'Bad request'});
                        else
                            res.json({
                                'channel_id': channel,
                                'chat_type': ch.chat_type,
                                'name': ch.name,
                                'messages': messages
                            });
                    });
                });
            }
            } catch(err) {
                res.status(500).json({'error': 'Server Error'});
            }

        },

       admin : function(req, res){
           // first get the user
           storage.get_all_channels(function(results){
               res.render("admin",{channels: results});
           });
       
        },


    
    };

    return routes;
};

