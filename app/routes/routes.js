// routes.js
// ---------
// Author: Amiel Kollek <a_kollek@live.ca>
//

var storage = require('../models/storage.js');
var nodemailer = require('nodemailer');

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
};


module.exports = function(io){

    routes = {
       landing : function(req, res){
            var invite_id = req.query.i;
            if (invite_id == undefined || invite_id == null)
                res.render("welcome");
            else {
                storage.get_invite(invite_id, function(invite){
                    if (!invite)
                        res.status(404).send("Invite not found");
                    else{
                        res.render('welcome', {
                            'channel': invite.channel,
                            'invite': invite._id,
                        });
                    }
                });
            }
       },

       signup: function(req,res){
            if(req.body.agreebox == 'on')
                res.render("signup");
            else{
                storage.get_content(function(content){
                    var consent = content.consent;
                    consent = consent.replace(new RegExp('&nbsp;', 'g'), ' ').replace(new RegExp('<br>', 'g'), '\n');
                    res.render('consent', {consent:consent});
                });
            }
       },

       forgot_password: function(req,res){
            res.render("forgot_password");
       },

       change_password: function(req, res){
            var username = req.body.username;
            storage.get_email(username, function(err, token, user){
                if(err)
                    return res.status(500).send("Oops. Something wrong.");
                if(user == undefined || user == null )
                    return res.render("forgot_password", {message: 'This account does not exist.'});

                if(user.email == undefined || user.email == null)
                    return res.render("forgot_password", {message: 'No email address available.'});
                else {
                    var smtpTransport = nodemailer.createTransport({
                        service: 'Gmail',
                        auth: {
                            user: 'ehims.new@gmail.com',
                            pass: 'ehims2016'
                        }
                      });
                      var mailOptions = {
                        to: user.email,
                        from: 'ehims.new@gmail.com',
                        subject: 'EHIMS Password Reset',
                        text: 'Dear '+user.firstname+' '+user.lastname+',\n\nYou are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                          get_socket_url() + 'reset?token=' + token + '\n\n' +
                          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
                      };
                      smtpTransport.sendMail(mailOptions, function(err) {
                        console.log('An e-mail has been sent to ' + user.email);
                      });
                      res.render('forgot_password', {message: 'An e-mail has been sent to '+user.email});
                }
            });
       },

       reset: function(req,res){
            storage.compare_token(req.query.token, function(err, user){
                if(!user){
                    //console.log(err);
                    res.render('reset_password', {message: 'Password reset token is invalid or has expired.'});
                } else {
                    res.render('reset_password', {name: user.name, token: req.query.token});
                }
            });
       },

       reset_password: function(req, res){
            var username = req.body.username;
            var password = req.body.password;
            var password2 = req.body.password2;
            var token = req.query.token;
            if(password2 != password)
                return res.render('reset_password', {message: 'Entered password is not matched.', name: username, token: req.query.token});;

            storage.change_password(username, password, function(err, user){
                if(err){
                    console.log(err);
                    res.status(500).send("Whoops, we had an error");
                    return;
                }
                var smtpTransport = nodemailer.createTransport({
                    service: 'Gmail',
                    auth: {
                        user: 'ehims.new@gmail.com',
                        pass: 'ehims2016'
                    }
                  });
                  var mailOptions = {
                    to: user.email,
                    from: 'ehims.new@gmail.com',
                    subject: 'Your password has been changed',
                    text: 'Hello,\n\n' +
                      'This is a confirmation that the password for your account ' + user.name + ' has just been changed.\n'
                  };
                  smtpTransport.sendMail(mailOptions, function(err) {
                    console.log('Password has been changed.');
                  });
            });
            res.render('welcome');
       },
       
       channels : function(req, res){
           var user = req.body.username;
           var pass = req.body.password;
           var pass2 = req.body.password_check;
           var firstname = req.body.firstname;
           var lastname = req.body.lastname;
           var email = req.body.email;
           var channel_id = req.body.channel_id; 
           var invite = req.body.invite;

            if(invite == 'undefined' || invite == null || invite == ''){
                if(email != undefined && email != null){
                    if(pass2 != pass)
                        return res.render("signup", 
                                { message: "Entered Password is not matching.", user:user, firstname:firstname, lastname:lastname,invite:invite,email:email});
                    storage.get_user(user, function(err, results){
                        if(!results){
                            storage.create_user(user, pass, firstname, lastname, email, function(results){
                                res.render("channels",{ user: {
                                    name: results.name,
                                    channels: results.channels
                                }});
                            });
                        } else {
                            res.render("signup", 
                                { message: "This username has already existed.", user:user, firstname:firstname, lastname:lastname,invite:invite,email:email});
                        }
                    })
               } else {
                    storage.get_user(user, function(err, results){
                        if(err){
                            res.render("welcome", 
                                    { message: "This account does not exist.", username:user});
                            return;
                        }
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
                                    { message: "The password is incorrect.", username:user});
                            }
                        });
                    })
               }
            } else {
               invite = invite.replace(get_socket_url()+'invite?i=', '');
                storage.get_invite(invite, function(result){
                    if(!result)
                        res.status(404).send("Invite not found");
                    else {
                        if(email != undefined && email != null){
                            storage.get_user(user, function(err, results){
                                if(results == null || results == undefined){
                                    storage.create_user(user, pass, firstname, lastname, email, function(new_user){
                                        storage.get_channel_by_id(result.channel, function(channel){
                                            if(!channel){
                                                return res.render("signup", { message: "This channel does not exist.", user:user, firstname:firstname, lastname:lastname,invite:invite,email:email});
                                            }
                                            user_join_channel(channel, new_user, res);
                                        });
                                    });
                                } else {
                                    res.render("signup", 
                                        { message: "This username has already existed.", user:user, firstname:firstname, lastname:lastname,invite:invite,email:email});
                                }
                            })
                       } else {
                            storage.get_user(user, function(err, results){
                                if(err){
                                    res.render('welcome', {
                                            'channel': channel_id,
                                            'username': user,
                                            'invite': invite,
                                            'message': "This account does not exist.",
                                        });
                                    return;
                                }
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
                                        res.render('welcome', {
                                            'channel': channel_id,
                                            'username': user,
                                            'invite': invite,
                                            'message': "The password is incorrect.",
                                        });
                                    }
                                });
                            })
                        }
                    }
                })
            }
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
                        storage.get_user(context.user, function(err, result){
                            context.user = result;
                            res.render("channels", context); 
                        });
                        return;
                    }
                    storage.get_user(context.user, function(err, result){
                        user_join_channel(channel, result, res);
                    });
                }
            );
        },
       
        join_channel : function(req, res){
            var channel_id = req.body.channel;
            var user = req.body.username;
            var context = { user: req.body.username,
                channel: req.body.channel,
                help_popup: get_help_popup(),
                socket_url : get_socket_url()};
            storage.get_channel_by_id(channel_id, function(channel){
                storage.get_user(user, function(err, result){
                    context.user = result;
                    if(!channel || err){
                        context.messages = {
                            join: "The channel does not exist"};
                        return res.render("channels", context);
                    }
                    user_join_channel(channel, result, res);
                });
            });
        },
       
        message : function(req, res){
           storage.create_message(req.body,function(message, top_lvl_messages){
               io.to(req.body.channel).emit('message',message, top_lvl_messages);
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
                    storage.get_content(function(contents){
                        res.render('admin', {channels: channels, survey_contents:contents});
                    })
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

       invite : function(req, res){
            var invite = req.body.invite;
            var pass = req.body.pass;
            var name = req.body.username;
            var channel_id = req.body.channel;
            storage.get_invite(invite, function(result){
                if(!result)
                    res.status(404).send("Page not found");
                else {
                    storage.get_user(name, function(err, results){
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
                                    'message': "The password is incorrect.",
                                });
                            }
                        });
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
            storage.create_exp_channel(time, function(err, channel){
                res.json({'channel':channel});
            })
        },

        create_group: function(req,res){
            storage.configure_exp_channel(req.body, function(invite_id, channel){
                res.json({'invite':invite_id, 'channel': channel});
            })
        },

        sub_group: function(req, res){
            storage.sub_group(req.body.id, function(msg){
                if (msg == "ok")
                    res.json("ok");
            });
        },

        edit_content:function(req, res){
            var content = req.body.msg;
            var id = req.body.id;
            storage.edit_content(id, content, function(msg){
                io.to(req.body.channel).emit('edited_content', msg);
                res.json({'msg': content, 'id':id});
            });
        },

        modify_hierarchy: function(req, res){
            storage.modify_hierarchy(req.body, function(data){
                io.to(req.body.channel).emit('modify_hierarchy', data);
                res.json(data);
            });
        },

        get_content: function(req,res){
            storage.get_content(function(content){
                res.json(content);
            });
        },

        update_survey: function(req, res){
            var data = req.body;
            storage.update_survey(data, function(){
                res.json(data);
            })
        },

        get_consent: function(req,res){
            storage.get_content(function(content){
                var consent = content.consent;
                consent = consent.replace(new RegExp('&nbsp;', 'g'), ' ').replace(new RegExp('<br>', 'g'), '\n');
                res.render('consent', {consent:consent});
            });
        },
    };

    return routes;
};

