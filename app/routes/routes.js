// routes.js
// ---------
// Author: Amiel Kollek <a_kollek@live.ca>

var storage = require('../models/storage.js');
var nodemailer = require('nodemailer');
var http = require('http');
var fs = require('fs');
var chokidar = require('chokidar');

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

var user_join_channel = function(channel, user, res, STARTTIME){
    if(STARTTIME == undefined || STARTTIME == null)
        STARTTIME = false;
    var socket_url = get_socket_url();
    var user_list = [];
    var context = { 
        STARTTIME: STARTTIME,
        user: user,
        channel: channel,
        participants: channel.participants,
        ctype: channel.chat_type,
        help_popup: get_help_popup(),
        socket_url : socket_url};
    if(STARTTIME == true){
          if(channel.type == "experiment" || channel.type == "in progress"){
              var seen = 0;
              channel.participants.forEach(function(dict){
                  if (dict.name == user.name)
                      seen = 1;
              });
              if(seen == 0){
                  res.render('error', {'message': 'Please follow the link to register first before join this channel: <a href="'+socket_url+'homepage">'+socket_url+'homepage</a><br><br>Thanks!', 
                                       'username': user.name});
                  return;
              }
          }
        if(channel.type == "result"){
            res.render('error', {'message': 'The experiment has finished yet.<br><br> Please follow the link to choose another channel: <a href="'+socket_url+'homepage">'+socket_url+'homepage</a><br><br>Thanks!', 
                                'username': user.name});
            return;
        }
    }
    else {
        if(channel.type == "in progress"){
            var seen = 1;
            channel.participants.forEach(function(dict){
              if (dict.name == user.name)
                  seen = 0;
            });
            if(seen == 1){
                res.render('error', {'message': 'Sorry this channel is full now. <br>Please follow the link to join another channel: <a href="'+socket_url+'assign">'+socket_url+'assign</a><br><br>Thanks!', 
                                     'username': user.name});
                return;
            }
        }
        if(channel.type == "result"){
            res.render('error', {'message': 'The experiment has finished yet.<br><br> Please follow the link to enter another channel: <a href="'+socket_url+'assign">'+socket_url+'assign</a><br><br>Thanks!', 
                                'username': user.name});
            return;
        }
    }
    
    storage.get_user_presurvey(user._id,function(err, box){
        if((channel.type != "routine" && box == false && STARTTIME == true) || err){
            res.render('error', {'message': 'Please follow the link to complete a pre survey before joining the channel: <a href="'+socket_url+'homepage">'+socket_url+'homepage</a><br><br>Thanks!', 
                                'username': user.name});
            return;
        }
        storage.get_messages_by_channel(channel._id, function(results){
             context.messages = results;
             var message_keys = Object.keys(results);
             var queue = [];
             for(var i = 0, len = message_keys.length; i<len;i++){
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
    })
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
                        res.render("welcome", {message: "Invite does not exist"});
                    else{
                        if(invite.experiment == true)
                            res.render('invite_login', {
                                'channel': invite.channel,
                                'invite': invite._id,
                            });
                        else
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
                res.render("signup", {invite:req.body.invite, channel_id:req.body.channel_id});
            else{
                storage.get_content(function(content){
                    res.render('consent', {consent:content.consent, invite:req.body.invite, channel_id:req.body.channel_id});
                });
            }
            //res.render('signup');
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
                        if(pass2 != pass)
                            return res.render("signup", 
                                  { message: "Entered Password is not matching.", user:user, firstname:firstname, lastname:lastname,invite:invite,email:email});
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
               io.to(req.body.channel).emit('message', message, top_lvl_messages);
               res.send('Message sent');
           });
        },

        download_channel : function(req, res) {
            try{
            var channel = req.query.channel;
            var channel_id = channel;
            console.log("Channel download: " + channel);
            if(channel === 'all'){
                storage.get_all_channels(function(channels){
                    storage.get_all_messages(function(messages){
                        neo4j.store_messages(messages);
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
                const writeFilePromise = (filename) => {
                    return new Promise((resolve, reject) => {
                        var watcher = chokidar.watch(filename, {
                            persistent: true
                        });
                        var exist = fs.existsSync(filename);
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
                                else{
                                    var result = JSON.stringify({
                                        'channel_id': channel,
                                        'chat_type': ch.chat_type,
                                        'name': ch.name,
                                        'tree_views': ch.tree_views,
                                        'participants': ch.participants,
                                        'duration': ch.duration,
                                        'started_at': ch.started_at,
                                        'messages': messages
                                    });
                                    var writeStream = fs.createWriteStream(filename, { flags : 'w' });
                                    writeStream.write(result);
                                    if(exist){
                                        watcher.on('change',path => {
                                            writeStream.on('finish', function() {
                                                writeStream.close();  // close() is async, call cb after close completes.
                                            });
                                            resolve('success');
                                        });
                                      } else {
                                          watcher.on('add',path => {
                                              writeStream.on('finish', function() {
                                                  writeStream.close();  // close() is async, call cb after close completes.
                                              });
                                              resolve('success');
                                          });
                                      }
                                }
                            });
                          });
                        });
                    };
                var promise = writeFilePromise('tmp_file/channel-'+channel_id+'.json');
                var flag = 0;
                promise.then((signal) => {
                    if(flag == 0){
                        return res.download('tmp_file/channel-'+channel_id+'.json');
                    }
                    console.log("Download survey results");
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
                        res.render('admin', {channels: channels, survey_contents:contents, socket_url: get_socket_url()});
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
                res.render('consent', {consent:content.consent, invite:req.body.invite, channel_id:req.body.channel_id});
            });
        },

        homepage: function(req,res){
            res.render('homepage');
        },

        assign: function(req, res){
          storage.get_content(function(content){
              storage.assign_account(function(err, user){
                if(err)
                  return;
                res.render('assign',{'user':user.name, 'password': user.password, 'consent': content.tester_consent});
              })
            })
        },

        login: function(req, res){
            if(req.body.agreebox == 'on')
              res.render('homepage', {'username': req.body.username});
            else{
               storage.get_content(function(content){
                    res.render('assign',{'user': req.body.username, 'password': req.body.password, 'consent': content.consent});
                })
             }
        },

        hall: function(req, res){
            if(req.body.agreebox == 'on'){
                storage.get_available_channels(function(err, channels){
                    if(err){
                        console.log(err);
                        return;
                    }
                    if(channels.length > 0){
                          storage.get_content(function(content){
                              res.render('presurvey_login', {username: req.body.username,channel:channels[0]._id, presurvey: content.pre_survey});
                          })
                    }
                    else{
                      storage.get_content(function(content){
                          res.render('error',{'username': req.body.username, 'message': "Sorry that our experiment is finished today. <br><br> Thank you!"});
                      }); 
                    }
                })
            }
            else{
                storage.get_content(function(content){
                    res.render('assign',{'user': req.body.username,'password':req.body.password, 'consent': content.consent});
                }); 
            }
        },

        presurvey_login:function(req, res){
            var data = req.body;
            storage.store_presurvey(data, function(err){
                if(err)
                    console.log(err);
                storage.store_channel_presurvey(data.channel, data.username, function(err1, channel){
                    if(err1)
                      console.log(err1);
                    storage.get_user(data.username, function(err2, user){
                        if(err2)
                          console.log(err2);
                        else
                          user_join_channel(channel, user, res, false);
                    })
                })
            });
        },

        instructions:function(req, res){
           var tester = {
              user: req.body.username,
              pass: req.body.password,
              channel_id: req.body.channel_id,
              invite: req.body.invite,
              socket_url: get_socket_url(),
           };
           storage.get_content(function(content){
                var instructions = content.instructions;
                instructions = instructions.replace(new RegExp('&nbsp;', 'g'), ' ').replace(new RegExp('<br>', 'g'), '\n');
                res.render('instructions', {instructions:instructions, tester:tester});
            });
        },

        tester_channels: function(req, res){
            var tester = req.body.tester;
            if(tester == 'undefined' || tester == null || tester == ''){
                var user = req.body.username;
                var pass = req.body.password;
                var channel_id = req.body.channel_id; 
                var invite = req.body.invite;
                var socket_url = get_socket_url();
                storage.get_user(user, function(err, results){
                    storage.get_available_channels(function(err1, channels){
                        if(err || err1){
                            console.log(err);
                            res.render("homepage", 
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
                                res.render("scheduler",{ user: results, channels: channels, socket_url:socket_url});
                            } else {
                                res.render("homepage", 
                                    { message: "The password is incorrect.", username:user});
                            }
                        });
                    })
                })
            } else {
                tester = JSON.parse(tester);
                if(req.body.agreebox != "on"){
                  storage.get_content(function(content){
                      var instructions = content.instructions;
                      instructions = instructions.replace(new RegExp('&nbsp;', 'g'), ' ').replace(new RegExp('<br>', 'g'), '\n');
                      res.render('instructions', {instructions:instructions, tester:tester});
                  });
                  return;
                }
                var user = tester.user;
                var pass = tester.pass;
                var channel_id = tester.channel_id; 
                var invite = tester.invite;
                var socket_url = get_socket_url();
                storage.get_invite(invite, function(result){
                    if(!result)
                        res.status(404).send("Invite not found");
                    else {
                        storage.get_user(user, function(err, results){
                            if(err){
                                res.render('homepage', {
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
                                        user_join_channel(channel, results, res, true);
                                    });
                                } else {
                                    res.render('homepage', {
                                        'channel': channel_id,
                                        'username': user,
                                        'invite': invite,
                                        'message': "The password is incorrect.",
                                    });
                                }
                            });
                        })
                    }
                })
            }
        },

        register:function(req, res){
            var channel_id = req.body.channel;
            var username = req.body.username;
            storage.register(channel_id, username, function(err, channel){
              if(channel){
                io.to('scheduler').emit('register', channel.participants.length, channel.users_number, channel._id);
                res.json(JSON.stringify({msg:'ok'}));
              }
            });
        },

        presurvey:function(req, res){
            storage.get_content(function(content){
              res.render('presurvey', {username: req.body.username,channel:req.body.channel, presurvey: content.pre_survey});
            })
        },

        submit_presurvey: function(req, res){
          var data = req.body;
          storage.store_presurvey(data, function(err){
            if(err){
              console.log(err);
              return;
            }
            storage.store_channel_presurvey(data.channel, data.username, function(err1, channel){
                if(!err1){
                  res.render('after_presurvey', {socket: get_socket_url(), channel: channel, username: data.username});
                }
                else
                  console.log(err1);
            })
          });
        },

        start: function(req, res){
            var channel = req.body.channel;
            storage.start_experiment(channel, function(err, type){
                if(!err){
                  res.json({'type': "in progress"});
                  io.to('admin').emit('status_update', channel, "Ongoing");
                }
            })
        },

        postsurvey: function(req,res){
            storage.get_content(function(content){
                storage.complete_experiment(req.body.channel, req.body.username, function(err, status, postsurvey, duration){
                    if(!err){
                        io.to('admin').emit('status_update', req.body.channel, status, postsurvey, duration);
                        io.to(req.body.channel).emit('stop_experiment', 1);
                        res.render('postsurvey', {channel: req.body.channel, username: req.body.username, postsurvey: content.post_survey});
                    }
                });
            });
        },

        submit_postsurvey: function(req, res){
          var data = req.body;
          storage.submit_postsurvey(data.channel, data.username, function(err, count, duration){
            if(!err){
                storage.store_postsurvey(data, function(err1, survey_code){
                  if(!err1){
                    res.render('thanks', {username: data.username, survey_code: survey_code});
                    io.to('admin').emit('status_update', data.channel, 'Finished', count, duration);
                  }
              });
            }
          })
        },

        search_code: function(req, res){
            var code = req.body.code;
            storage.search_code(code, function(err, presurvey, postsurvey){
              if(err)
                res.json(err);
              res.json({'presurvey':presurvey, 'postsurvey':postsurvey});
            })
        },

        force_stop: function(req,res){
            storage.complete_experiment(req.body.channel, req.body.username, function(err, status, postsurvey, duration){
              if(!err){
                  io.to('admin').emit('status_update', req.body.channel, status, postsurvey, duration);
                  res.json('data');
              }
            });
        },

        download_individual:function(req, res){
            const writeFilePromise = (filename) => {
                return new Promise((resolve, reject) => {
                    var watcher = chokidar.watch(filename, {
                        persistent: true
                    });
                    var exist = fs.existsSync(filename);
                    storage.individual_info(function(err, results){
                        if(err)
                          return console.log(err);
                        var writeStream = fs.createWriteStream(filename, { flags : 'w' });
                        writeStream.write(JSON.stringify(results));
                        if(exist){
                            watcher.on('change',path => {
                                writeStream.on('finish', function() {
                                    writeStream.close();  // close() is async, call cb after close completes.
                                });
                                resolve('success');
                            });
                          } else {
                              watcher.on('add',path => {
                                  writeStream.on('finish', function() {
                                      writeStream.close();  // close() is async, call cb after close completes.
                                  });
                                  resolve('success');
                              });
                          }
                    });
                    });
                };
            var promise = writeFilePromise('tmp_file/survey_results.json');
            promise.then((signal) => {
                res.download('tmp_file/survey-results.json');
                console.log("Download survey results");
            });
        },
    };

    return routes;
};

