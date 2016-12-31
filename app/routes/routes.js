// routes.js
// ---------
// Author: Amiel Kollek <a_kollek@live.ca>
//

var storage = require('../models/storage.js');

var get_socket_url = function(){
    return process.env.NODE_ENV ? 'https://ehims-new.herokuapp.com/' : 'http://localhost:3000/';
};

var get_help_popup = function() {
    var hp = process.env.HELP_POPUP;
    return hp ? hp : false;
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
                help_popup: get_help_popup(),
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
           var pass = req.body.pass;
           if(pass === 'ehims2016'){
               storage.get_all_channels(function(results){
                   res.render("admin",{channels: results});
               });
           } else {
               res.render("admin_login", {message:"Incorrect Password"});
           }
        },

       admin_login : function(req, res){
            res.render("admin_login");
        },

       make_invite : function(req, res){
            var channel = req.body.channel;
            var username = req.body.username;
            var password = req.body.password;

            storage.create_invite(channel, username, password, function(invite){
                res.json({'invite': invite._id});
            });
        },

       invite_login : function(req, res){
            storage.get_invite(req.query.i, function(invite){
                if (!invite)
                    res.status(404).send("Page not found");
                else
                    res.render('invite_login', {
                        'channel': invite.channel,
                        'username': invite.username,
                        'invite': invite._id,
                    });
            });
        },

       invite : function(req, res){
            storage.get_invite(req.body.invite, function(invite){
                if(!invite)
                    res.status(404).send("Page not found");
                else if(invite.password !== req.body.pass) {
                    res.render('invite_login', {
                            'channel': invite.channel,
                            'username': invite.username,
                            'invite': invite._id,
                            'message': "Incorrect password",
                        });
                } else {
                    var socket_url = get_socket_url();
                    var context = { 
                        user: invite.username,
                        channel: invite.channel,
                        help_popup: get_help_popup(),
                        socket_url : socket_url};
                    storage.get_or_create_user(context.user,function(results){
                        var user = results;
                        context.user = user;
                        console.log("Created user");
                        storage.join_channel(user, context.channel, 
                            join_channel(context, res));
                    });
                }
            });
       
       },

    };



    return routes;
};

