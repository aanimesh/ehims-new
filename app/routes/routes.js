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
    return hp === "true";
};

var join_channel = function(context, res, err_func){
     return function(err, results){
     if(err){
         err_func(err);
         return;
     }
     var channel = results.channel;
     //channel.log_user_in(context.user);
     //channel.save();
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
         res.render("channel", context);
     });
};};

var user_join_channel = function(channel, user, res){
    var socket_url = get_socket_url();
    var user_list = [];
    var context = { 
        user: user,
        channel: channel,
        participants: channel.participants,
        ctype: channel.chat_type,
        help_popup: get_help_popup(),
        socket_url : socket_url};
    if(channel.type == "experiment"){
        var seen = 0;
        channel.participants.forEach(function(dict){
            if (dict.id == user._id)
                seen = 1;
        });
        if(seen == 0 && channel.participants.length >= channel.users_number){
            res.status(500).send("too many participants");
            return;
        }
    }
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
         storage.join_channel(user, channel._id, function(err){
            if(err){
                console.log(err);
                res.status(500).send("Whoops, we had an error");
                return;
            }
             console.log("Connected Users");
             res.render("channel", context);
         });
     });
    /*storage.join_channel(user, context.channel, 
        join_channel(context, res, function(err){
            console.log(err);
            res.status(500).send("Whoops, we had an error");
            return;
    }));*/
    /*storage.get_user(name, function(err, results){
        if(err){
            console.log(err);
            res.status(500).send("Whoops, we had an error");
            return;
        }
        if(channel.type == "experiment"){
            var seen = 0;
            channel.participants.forEach(function(user){
                if (user == results._id)
                    seen = 1;
            });
            if(seen == 0 && channel.participants.length >= channel.users_number){
                res.status(500).send("too many participants");
                return;
            }
        }
        var user = results;
        context.user = user;
        storage.join_channel(user, context.channel, 
            join_channel(context, res,
                function(err){
                    console.log(err);
                    res.status(500).send("Whoops, we had an error");
                    return;
        }));
    })*/
};

module.exports = function(io){

    routes = {
       landing : function(req, res){
           res.render("welcome");
       },
       
       channels : function(req, res){
           var user = req.body.username;
           var pass = req.body.password;
           var channels;
       
           // first get the user
           storage.get_user(user,function(err, results){
               if(err){
                    storage.create_user(user, pass, function(results){
                        res.render("channels",{ user: {
                            name: results.name,
                            channels: results.channels
                        }});
                    });
               } else { 
                    results.comparePassword(pass, function(err, match){
                        if(err){
                            console.log(err);
                            res.status(500).send("Whoops, we had an error");
                            return;
                        }
                        if (match) {
                            res.render("channels",{ user: {
                                name: results.name,
                                channels: results.channels
                            }});
                        } else {
                            res.render("welcome", 
                                { message: "This username exists, and the password is incorrect"});
                        }
                    });
               }
           });
       
        },

        back_channels : function(req, res){
            storage.get_user(req.body.username, function(err, results){
                res.render("channels",{ user: {
                    name: results.name,
                    channels: results.channels
                }});
            });
        },

        create_channel : function(req, res){
            var socket_url = get_socket_url();
            var context = { user: req.body.username,
                channel: req.body.channel,
                help_popup: get_help_popup(),
                socket_url : socket_url};
            storage.create_channel(context.channel, req.body.ctype,
                function(err, channel) {
                    if(err){
                        console.log(err);
                        context.messages = {
                            create: "The channel you tried to create already exists"};
                        res.render("channels", context); 
                        return;
                    }
                    storage.get_user(context.user, function(err, result){
                        user_join_channel(channel, result, res);
                    });
                }
            );

            /*var socket_url = get_socket_url();
            var context = { user: req.body.username,
                channel: req.body.channel,
                help_popup: get_help_popup(),
                socket_url : socket_url};
            storage.get_user(context.user,function(err, results){
                if(err){
                    console.log(err);
                    res.status(500).send("Whoops, we had an error");
                    return;
                }
                var user = results;
                context.user = user;
                storage.create_channel(context.channel, req.body.ctype,
                    function(err, channel) {
                        if(err){
                            console.log(err);
                            context.messages = {
                                create: "The channel you tried to create already exists"};
                            res.render("channels", context); 
                            return;
                        }
                        context.channel = channel._id;
                        storage.join_channel(user, context.channel,
                            join_channel(context, res, function(err){
                                if(err){
                                    console.log(err);
                                    context.messages = {
                                        create: "There was an error, try again"};
                                    res.render("channels", context); 
                                }
                        }));
                    });
            });*/
        },
       
        join_channel : function(req, res){
            var channel_id = req.body.channel;
            var user = req.body.username;
            storage.get_channel_by_id(channel_id, function(channel){
                storage.get_user(user, function(err, result){
                    user_join_channel(channel, result, res);
                });
            });
            /*var socket_url = get_socket_url();
            var context = { user: req.body.username,
                channel: req.body.channel,
                help_popup: get_help_popup(),
                socket_url : socket_url};
            storage.get_user(context.user,function(err, results){
                if(err){
                    console.log(err);
                    res.status(500).send("Whoops, we had an error");
                    return;
                }
                var user = results;
                context.user = user;
                storage.join_channel(user, context.channel,
                    join_channel(context, res, function(err){
                        console.log(err);
                        context.messages = {
                            join: "The channel you tried to join does not exist"};
                        res.render("channels", context); 
                    }));
                //storage.join_channel(user, context.channel, function(){});
            });*/
        },
       
        message : function(req, res){
           storage.create_message(req.body,function(message, top_lvl_messages){
               io.to(req.body.channel).emit('message',message, top_lvl_messages);
               res.send('Message sent');
           });
           //storage.update_message(req.body);
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
                    if(ch === null || ch === undefined) { 
                        res.status(400).json({'error': 'Bad request'});
                        return;
                    }
                    storage.get_messages_by_channel(channel, function(messages) {
                        if(messages === null || messages === undefined) {
                            res.status(400).json({'error': 'Bad request'});
                            return;
                        }
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
               storage.get_all_exp_channels(function(channels){
                res.render('admin', {channels: channels});
               })
           } else {
               res.render("admin_login", {message:"Incorrect Password"});
           }
        },

       admin_login : function(req, res){
            res.render("admin_login");
        },

       make_invite : function(req, res){
            var channel = req.body.channel;
            storage.create_invite(channel, function(invite){
               if(invite)
                    res.json({'invite': invite._id});
            });
        },

       invite_login : function(req, res){
            storage.get_invite(req.query.i, function(invite){
                if (!invite)
                    res.status(404).send("Page not found");
                else{
                    res.render('invite_login', {
                        'channel': invite.channel,
                        'invite': invite._id,
                    });
                }
            });
        },

       invite : function(req, res){
            var invite = req.body.invite;
            var pass = req.body.pass;
            var name = req.body.username;
            var channel_id = req.body.channel;
            storage.get_invite(invite, function(result){
                if(!result)
                    res.status(404).send("Page not found");
                else {
                    // public invitaion
                    storage.get_user(name, function(err, results){
                        // create new user
                        if(err){
                            storage.create_user(name, pass, function(user){ 
                                storage.get_channel_by_id(channel_id, function(channel){
                                    user_join_channel(channel, user, res);
                                });
                            });
                        }
                        else{
                            results.comparePassword(pass, function(err, match){
                                if(err){
                                    console.log(err);
                                    res.status(500).send("Whoops, we had an error");
                                    return;
                                }
                                if (match) {  
                                    storage.get_channel_by_id(channel_id, function(channel){
                                        user_join_channel(channel, results, res);
                                    });
                                } else {
                                    res.render('invite_login', {
                                        'channel': channel_id,
                                        'username': req.body.username,
                                        'invite': invite,
                                        'message': "Incorrect password",
                                    });
                                }
                            });
                        }
                    })
                }
            })
       },

        likes : function(req, res){
            var msg_id = req.body.msg_id;
            var user = req.body.user;
            storage.likes(msg_id, user, function(err, likes_length, msg_likes){
                res.json({'length':likes_length});
                io.to(req.body.channel).emit('likes',{likes: msg_likes, msg_id: msg_id, user:user});
            });
        },

        bookmark: function(req, res){
            var msg_id = req.body.msg_id;
            var user = req.body.user;
            storage.bookmark(msg_id, user, function(err, bookmarked){
                res.json({"bookmarked": bookmarked});
            });
        },

        add_group: function(req, res){
            var time=req.body.time;
            time = time.replace(' ', '');
            storage.create_exp_channel(time, function(err, channel_id, group_id){
                res.json({"channel_id": channel_id, "group_id": group_id});
            })
        },

        create_group: function(req,res){
            storage.configure_exp_channel(req.body, function(invite_id, channel){
                res.json({'invite':invite_id, 'channel': channel});
            })
        },

        sub_group: function(req, res){
            storage.sub_group();
        },

        edit_content:function(req, res){
            var content = req.body.msg;
            var id = req.body.id;
            storage.edit_content(id, content, function(msg){
                io.to(req.body.channel).emit('edited_content', msg);
                res.json({'msg': content, 'id':id});
                //console.log(msg);
            });
        },

        modify_hierarchy: function(req, res){
            storage.modify_hierarchy(req.body, function(data){
                io.to(req.body.channel).emit('modify_hierarchy', data);
                res.json(data);
            });
        },
    };

    return routes;
};

