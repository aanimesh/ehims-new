// storage.js
// Author: Amiel Kollek <a_kollek@live.ca>
// ---------------------------------------
// 
// This file contains all code needed for
// interfacing with the database
var WAITING_MINUTES = 10;

var MongoClient = require('mongodb').MongoClient;
var mongoose = require('mongoose');
var assert = require('assert');
var CryptoJS = require('crypto-js');
var _mongo_url = process.env.MONGOLAB_URI || 
                 process.env.MONGOHQ_URL  || 
                 'mongodb://localhost:27017/ehims';
var crypto = require('crypto');
var bcrypt = require('bcrypt');
var SALT_WORK_FACTOR = 10;

mongoose.connect(_mongo_url);
// load models
var User = require('./user.js').User;
var Channel = require('./channel.js').Channel;
var Message = require('./message.js').Message;
var Invite = require('./invite.js').Invite;
var Survey = require('./survey.js').Survey;

/**
 * Get user
 * @param {String} username
 * @param {function} callback, to be called with err as first arg, user document 2nd 
 */
var get_user = function(name,callback){

    User.findOne({'name': name},function(err, user){
        // assert.equal(null, err);
        if(!user){
            callback({err: "User doesn't exist"});
            return;
        }
        callback(null, user);
    });
};

/**
 * Create User
 * @param {String} username
 * @param {String} password
 * @param {function} callback, to be called on the new user document
 */

var create_user = function(user, pass, firstname, lastname, email, callback) {
    var user = new User({'name':user, 'password': pass, 'channels': [], 'newcoming':true,
                        'firstname': firstname, 'lastname': lastname, 'email': email});
    user.save().then(function(user){
        callback(user);
    });
};

/**
 * get channel by name
 * @param {String} channel name
 * @param {function} callback to be called on channel
 */
var get_channel_by_name = function(channel_name, callback){
    Channel.findOne({ 'name': channel_name },function(err, channel){
        // assert.equal(null, err);
        callback(channel);
    });
};

/**
 * get channel by id
 * @param {String} channel id
 * @param {function} callback to be called on channel
 */
var get_channel_by_id = function(channel_id, callback){
    Channel.findOne({ '_id': channel_id },function(err, channel){
        // assert.equal(null, err);
        callback(channel);
    });
};

/**
 * get channels
 * @param {function} callback to be called on list of channel objects
 */
var get_all_channels = function(callback){
    Channel.find({},function(err, channels){
        // assert.equal(null, err);
        callback(channels);
    });
};


/**
 * get messages
 * @param {function} callback to be called on list of message objects
 */
var get_all_messages = function(callback){
    Message.find({},function(err, messages){
        // assert.equal(null, err);
        callback(messages);
    });
};

/**
 * create channel
 * @param {Object} User
 * @param {String} channel name
 * @param {String} chat type (line, tree, or graph)
 * @param {function} callback to be called on (err, channel)
 */
var create_channel = function(channel_name, chat_type, callback){
     // when creating a new channel, add the chat type
     // to the name
     //      Ensures name uniqueness and also makes it
     //      clear to the user the type of chat they're in
     switch(chat_type){
         case 'path':
             channel_name += ' (Sequential)';
             break;
         case 'tree':
             channel_name += ' (Tree)';
             break;
         case 'graph':
             channel_name += ' (Graph)';
             break;
     }
    Channel.findOne({'name':channel_name}, function(err, channel){
        if (channel != null & channel != undefined)
            callback("The channel you tried to create already exists", null);
        else{
            channel = new Channel({'name': channel_name,
                             'chat_type': chat_type,
                             //'online_users': [],
                             'users': [],
                             'participants': [],
                             'top_lvl_messages': []});
            channel.save().then(function(channel){
                callback(null, channel)});
        };
    });
};

var join_channel = function(user, channel_id, callback){
    Channel.findOne({'_id':channel_id},
        function(err, channel){
            if (!channel){
                callback({err: "Channel does not exist"});
                return;
            }
            user.join_channel(channel);
            channel.log_user_in(user);
            callback(null, {'user':user,'channel':channel});
        });
};

/*var user_join_channel = function(user, channel){
    var seen = false;
    var channels = user.channels;
    for(var i = channels.length-1;  i >= 0; i--)
        if(channels[i]._id.equals(channel._id))
            seen = true;
    if(!seen){
        channels.push({
            name:channel.name, chat_type:channel.chat_type, _id:channel._id});
        User.update({_id:user._id}, {$set:{channels:channels}}, {upsert:true},function(err){})
    }
};*/


/**
 * Get users
 * @param {Array} Array of user ids
 * @param {function} callback to be called on [usernames]
 */

var get_usernames = function(ids, callback){
    User.find({
        '_id' : { $in : ids }
    }, function(err, users){
        // assert.equal(null, err);
        var user_list = [];
        users.forEach(function(u){user_list.push({name:u.name});});
        callback(user_list);
    });
};

/**
 * Get messages by channel
 * @param {String} channel id
 * @param {function} callback to be called on { message_id : message, ... }
 */

var get_messages_by_channel = function(channel_id, callback){
    Message.find({
        channel : channel_id
    }, function(err, message_objs){
        // assert.equal(null, err);
        var messages = {};
        message_objs.forEach(function(m){messages[m._id] = m;});
        callback(messages);
    });
};

/**
 * Get message
 * @param {String} message id
 * @param {function} callback to be called on message_id
 */

var get_message = function(message_id, callback){
    Message.findOne({
        '_id' : message_id
    }, function(err, message){
        // assert.equal(null, err);
        callback(message);
    });
};


/**
 * Get message
 * @param {String} message id
 * @param {function} callback to be called on message_id
 */

var get_messages = function(message_ids, callback){
    ids = message_ids.map(mongoose.Types.ObjectId);
    //console.log(ids);
    Message.find({
        '_id' : { $in : ids }
    }, function(err, messages){
        // assert.equal(null, err);
        callback(messages);
    });
};



/**
 * Create message
 * @param {json} Message data
 * @param {function} callback to be called on the resulting message
 */
var create_message = function(msg, callback){
    var message = new Message(msg);
    message.save();
    // add message to top lvl messages if it doesn't have a parent
    if(message.msg_parent === null || message.msg_parent === undefined){
        get_channel_by_id(message.channel, function (channel){
            channel.top_lvl_messages.push(message);
            Channel.update({_id:channel._id}, {$set: { top_lvl_messages: channel.top_lvl_messages}}, {upsert: true}, function(err){});
            callback(message, channel.top_lvl_messages);
        });
    } else {
        // get all the parents and make this message a child
        get_messages([message.msg_parent].concat(message.other_parents),function(ps){
            for(var i=ps.length-1; i >= 0; i--){ 
                ps[i].children.push(message._id);
                Message.update({_id:ps[i]._id}, {$set: { children: ps[i].children }}, {upsert: true}, function(err){});
            }
            get_channel_by_id(message.channel, function(channel){
                callback(message, channel.top_lvl_messages);
            });
        });
    }
};


var create_invite = function(channel, callback){
    Channel.findOne({"_id":channel}, function(err, channel){
        if(err)
            return console.log(err);
        if(channel.type == 'routine'){
            if(channel.invite_link == null || channel.invite_link == undefined){
                var invite = new Invite({
                    'channel': channel,
                });
                invite.save().then(function(invite){
                    callback(invite);
                    Channel.updateOne({"_id":channel}, {$set:{invite_link: invite._id}},function(){});
                });
            } else {
                callback(channel.invite_link);
            }
        } else {
            if(channel.invite_link == null || channel.invite_link == undefined){
                var invite = new Invite({
                    'channel': channel,
                    'experiment': true,
                });
                invite.save().then(function(invite){
                    callback(invite);
                    Channel.updateOne({"_id":channel}, {$set:{invite_link: invite._id}},function(){});
                });
            } else {
                callback(channel.invite_link);
            }
        }
    })
};

var get_invite = function(invite_id, callback){
    Invite.findOne({
        '_id' :  invite_id
    }, function(err, messages){
        // assert.equal(null, err);
        callback(messages);
    });
};

var get_message_ids = function(msg, callback){
    var results = [];
    for(var i = 0; i < msg.length; i ++){
        results.push(msg[i]._id);
    }
    callback(results);
};

var likes = function(msg_id, user, callback){
    Message.findOne({'_id': msg_id}, function(err, msg){
        //console.log(msg);
        if(msg.likes.includes(user)){
            msg_likes = msg.likes.filter( function(value){
                    return value !== user;
            });
            Message.update({_id:msg_id}, {$set: { likes: msg_likes}}, {upsert: true}, function(err){});
            callback(err, msg.likes.length-1, msg_likes);
        }
        else{
            msg.likes.push(user);
            Message.update({_id:msg_id}, {$set: { likes: msg.likes }}, {upsert: true}, function(err){});
            callback(err, msg.likes.length, msg.likes);
        }
    });
}

var add_online_users = function(channel_id, username, callback){
    get_user(username, function(err, user){
        if(err|| !user)
            callback(err, null);
         get_channel_by_id(channel_id, function(channel){
            if(channel == null || channel == undefined)
                callback(err, null);
            else{
                if(channel.participants == null || channel.participants == undefined)
                    callback(err, null);
                else{
                    var seen = false;
                    var length = channel.participants.length;
                    var participants = channel.participants;
                    for(var i = 0; i < length; i ++){
                        if(participants[i].name == user.name){
                            seen = true;
                            participants[i].online = true;
                            channel.participants = participants;
                            channel.save();
                            break;
                        }
                    }
                    if(seen === false){
                        participants.push({name: user.name, online: true, color: length, id: user._id});
                        Channel.update({_id: channel_id}, {$set: {participants: participants}}, {upsert: true}, function(err){});
                    }
                    callback(err, participants);
                    }   
                }
         });
    });
}

var sub_online_users = function(channel_id, username, callback){
    get_user(username, function(err, user){
        if(err)
            callback(err);
        get_channel_by_id(channel_id, function(channel){
            if(channel.participants == null || channel.participants == undefined)
                callback(err, null);
            channel.participants.forEach(function(dict){
                if(dict.name == username)
                    dict.online = false;
            });
            channel.save();
            callback(err, channel.participants);
         });
    });
}

var bookmark = function(msg_id, username, callback){
    Message.findOne({"_id": msg_id}, function(err, msg){
        var bookmarked = new Boolean(false);
        msg.bookmarked.forEach(function(user){
            if(user == username)
                bookmarked = true;
        })
        if (bookmarked === true){
            bookmarked = false;
            Message.update({_id: msg_id}, {$set: { bookmarked: msg.bookmarked.filter(tuser => tuser != username)}}, {upsert:true}, function(){});
        }
        else{
            bookmarked = true;
            Message.update({_id: msg_id}, {$push: { bookmarked: username}}, {upsert:true}, function(){});
        }
        callback(err, bookmarked);
    })
}

var create_exp_channel = function(time, callback){
    channel = new Channel({'name': 'tmpname-exp-'+time,
                     'chat_type': 'tree',
                     'participants': [],
                     'type': 'experiment',
                     'users_number': null,
                     'top_lvl_messages': []});
    channel.save().then(function(channel){
        callback(null, channel)});
};

var configure_exp_channel = function(data, callback){
    var channel_name = 'Group-'+data['time'];
    switch(data['chat_type']){
         case 'path':
             channel_name += ' (Sequential)';
             break;
         case 'tree':
             channel_name += ' (Tree)';
             break;
         case 'graph':
             channel_name += ' (Graph)';
             break;
     };
    var invite = new Invite({'channel': data['channel_id'], 'experiment': true});
    invite.save().then(function(invite){
        Channel.update({'_id':data['channel_id']},{ $set:{
            tree_views:data['tree_views'],
            started_at:data['time'],
            chat_type:data['chat_type'],
            name: channel_name,
            users_number: parseInt(data['number']),
            invite_link: invite._id,
        }}, {upsert:true}, function(err){
            Channel.findOne({'_id': data['channel_id']}, function(err, channel){
                callback({'invite':invite._id, 'channel': channel});
            });
        });
    });
};

var get_all_exp_channels = function(callback){
    Channel.deleteMany({'name':{ $regex: /tmpname-exp-/, $options: 'i' }}).then(function(){
        Channel.find({$or:[{'type':"experiment"}, {'type':"in progress"}, {'type':"result"}]},function(err, channels){
            callback(channels);
        });
    });
};

var sub_group = function(id, callback){
    Channel.updateOne({"_id":id}, {$set:{type: 'routine'}}, function(){callback("ok")});
};

var edit_content = function(id, content, callback){
    Message.findOne({"_id":id}).exec(function(err, msg){
        if(msg.original_version.length == 0 || msg.original_version == undefined || msg.original_version == null)
            msg.original_version = [msg.content];
        else
            msg.original_version.push(msg.content);
        Message.updateOne({"_id":id}, {$set:{content:content, original_version:msg.original_version}}, {upsert:true}, function(){
            msg.content = content;
            callback(msg);
        });
    });
};

var modify_hierarchy = function(data, callback){
    var child_id = data.child_id;
    var change_parents = data.parent_ids;
    var channel_id = data.channel;
    data.record = '*orginal parents*: ' + data.original_parent.join(',');
    data.record = data.record.trim(', ');
    Message.findOne({"_id": child_id}, function(err, cmsg){
        var bulkOps = [];
        var channelOps = [];
        if(cmsg.msg_parent != null && cmsg.msg_parent != undefined){
            /*Message.findOne({"_id":cmsg.msg_parent}, function(err, op){
                op.children = op.children.filter(child => child != child_id);
                Message.updateOne({"_id":cmsg.msg_parent},{$set:{children: op.children}}, {upsert:true}, function(){});
            });*/
            let updateParent = {
                'updateOne': {
                    'filter': {'_id': cmsg.msg_parent},
                    'update': {$pull: {'children': mongoose.Types.ObjectId(child_id)}},
                    'upsert': true,
                    'multi': true
                }
            };
            bulkOps.push(updateParent);
            /*if(cmsg.other_parents != undefined){
                cmsg.other_parents.forEach(function(other_parent){
                    Message.findOne({"_id":other_parent}, function(err, op1){
                        op1.children = op1.children.filter(child => child != child_id);
                        Message.updateOne({"_id":other_parent},{$set:{children: op1.children}}, {upsert:true}, function(){});
                    });
                });
            }*/
            for(var i=0; i < cmsg.other_parents.length; i ++){
                let updateParent = {
                    'updateOne': {
                        'filter': {'_id': cmsg.other_parents[i]},
                        'update': {$pull: {'children': mongoose.Types.ObjectId(child_id)}},
                        'upsert': true,
                    }
                };
                bulkOps.push(updateParent);
            }
        }else{
            /*Channel.findOne({"_id":channel_id},function(err, channel){
                channel.top_lvl_messages = channel.top_lvl_messages.filter(msg => msg != child_id); 
                Channel.updateOne({"_id": channel_id}, {$set:{top_lvl_messages: channel.top_lvl_messages}}, {upsert:true}, function(){});
            })*/
            let updateChannel = {
                'updateOne': {
                    'filter': {'_id': channel_id},
                    'update': {$pull: {'top_lvl_messages': mongoose.Types.ObjectId(child_id)}},
                    'upsert': true,
                }
            };
            channelOps.push(updateChannel);
        }
        
        var msg_parent = null;
        var other_parents = [];
        if(change_parents.includes("0")){
            /*Channel.findOne({"_id": channel_id}, function(err, channel){
                var seen = 0;
                channel.top_lvl_messages.forEach(function(m){
                    if (m == cmsg)
                        seen = 1;
                });
                if (seen == 0)
                    Channel.updateOne({"_id": channel_id}, {$push:{top_lvl_messages: mongoose.Types.ObjectId(child_id)}}, {upsert:true}, function(){});
            });*/
            let updateChannel = {
                'updateOne': {
                    'filter': {'_id': channel_id},
                    'update': {$push: {'top_lvl_messages': mongoose.Types.ObjectId(child_id)}},
                    'upsert': true,
                }
            };
            channelOps.push(updateChannel);
        }else{
            //change_parents = change_parents.filter(msg => msg != "0");
            //var bulkOps = [];
            for(var i = 0; i < change_parents.length; i ++){
                let updateMsg = {
                    'updateOne': {
                        'filter': {'_id': change_parents[i]},
                        'update': {$push: {'children': mongoose.Types.ObjectId(child_id)}},
                        'upsert': true,
                    }
                };
                bulkOps.push(updateMsg);
                if(i == 0)
                    msg_parent = mongoose.Types.ObjectId(change_parents[i]);
                else
                    other_parents.push(mongoose.Types.ObjectId(change_parents[i]));
            };
        };
        let updateMsg = {
            'updateOne': {
                'filter': {'_id': child_id},
                'update': {$set: {'msg_parent':msg_parent, 'other_parents':other_parents}, $push:{'original_version': data.record}},
                'upsert': true,
            }
        };
        bulkOps.push(updateMsg);

        Message.bulkWrite(bulkOps)
            .then( bulkWriteOpResult => {
                console.log('Hierarchy changed');
            })
            .catch( err => {
                console.log(err);
                console.log('Hierarchy failed to change');
            });
        if(channelOps.length > 0){
            Channel.bulkWrite(channelOps)
                .then( bulkWriteOpResult => {
                    console.log('top level msg changed');
                })
                .catch( err => {
                    console.log(err);
                    console.log('top level msg failed to change');
                });
            }
    });
    callback(data);
};

var get_channel = function(channel_id, callback){
    Channel.findOne({"_id": channel_id}, function(err, channel){
        get_usernames(channel.participants, function(list){
            get_usernames(channel.online_users, function(list1){
                callback(err, list1, list);
            });
        });
    });
};

var find_msg_by_author = function(author, channel_id, callback){
    Message.find({"channel":channel_id, "author":author}, function(err, msg){
        var results = [];
        msg.forEach(function(m){
            results.unshift(m._id);
        });
        callback(results);
    });
};

var get_email = function(name, callback){
    User.findOne({name: name}, function(err, user){
        var token;
        if(!user || err){
            callback(err, token, user);
            return;
        }
        crypto.randomBytes(20, (err, buf) => { 
            token = buf.toString('hex');
            user.resetPasswordToken = token;
            user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
            user.save().then(callback(err, token, user));
        });
    })
};

var compare_token = function(token, callback){
    User.findOne({resetPasswordToken: token, resetPasswordExpires: {$gt: Date.now()}}, function(err, user){
        callback(err, user);
    });
};

var change_password = function(name, password, callback){
    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        bcrypt.hash(password, salt, function(err, hash){
            User.updateOne({ name: name }, 
                {$set: {password: hash, resetPasswordToken: undefined, resetPasswordExpires: undefined}},
                {new: true}, function(err, user){
                    callback(err, user);
                }
            );
        })
    })
}; 

var get_content = function(callback){
    Survey.findOne({"questionnaire" : true}, function(err, data){
        callback(data);
    });
};

var update_survey = function(data, callback){
    Survey.updateOne({},
        {$set:{consent: data.consent, pre_survey: data.pre_survey, post_survey: data.post_survey, tester_consent: data.tester_consent}}
    ).then(callback);
};

var get_available_channels = function(callback){
    Channel.find({"type" : "experiment"}, function(err, results){
        if(err)
            callback(err);
        callback(err, results);
    })
};

var register = function(channel_id, username, callback){
    Channel.findOne({"_id": channel_id}, function(err, channel){
        User.findOne({"name":username}, function(err1, user){
            if(err || err1)
                return callback(err);
            if(channel == null || channel == undefined)
                return callback(err);
            if(channel.participants.length >= channel.users_number){
                return callback(err);
            }
            user.join_channel(channel);
            if(channel.participants == null || channel.participants == undefined)
                channel.participants = []
            var seen = false;
            var length = channel.participants.length;
            var participants = channel.participants;
            for(var i = 0; i < length; i ++){
                if(participants[i].name == user.name){
                    seen = true;
                    break;
                }
            }
            if(seen == false){
                participants.push({name: user.name, online: false, color: length, id: user._id});
                Channel.updateOne({_id: channel_id}, {$set: {participants: participants}}, {upsert:true}, function(){});
            }
            channel.participants = participants;
            callback(err, channel);
        })
    })
};

var store_presurvey = function(data, callback){
    User.findOne({"name":data.username}, function(err,user){
        if(err)
            callback(err);
        var presurvey = [];
        Object.keys(data).forEach(key => {
            if(key != 'channel' && key != 'username'){
                presurvey.push({'name':key,'answer':data[key]});
            }
        });
        Survey.updateOne({"user": user._id}, {$set:{
            channel:data.channel,
            questionnaire: false,
            pre_survey: presurvey,
        }}, {upsert: true}, function(){});
        callback(err);
    })
};

var start_experiment = function(channel_id, callback){
    var now = new Date().toLocaleString("en-US", { timeZone: 'America/Montreal' });
    Channel.updateOne({"_id": channel_id}, 
        {$set:{type: "in progress", started_at: now}}, {upsert: true}, function(err){
            if(err)
                callback(err)
            callback(err, "in progress");
        })
};

var get_user_presurvey = function(user_id, callback){
    Survey.findOne({"user": user_id}, function(err, user){
        if(err)
            callback(err);
        if(user)
            callback(err, true);
        else
            callback(err, false);
    })
};

var store_postsurvey = function(data, callback){
    var postsurvey = [];
    Object.keys(data).forEach(key => {
        if(key != 'channel' && key != 'username'){
            postsurvey.push({'name':key, 'answer':data[key]});
        }
    });
    User.findOne({"name":data.username}, function(err, user){
        if(err)
            callback(err);
        Survey.updateOne({"user": user._id}, {$set:{
            questionnaire: false,
            post_survey: postsurvey,
        }}, {upsert: true}, function(err1){});
        var encrypt = CryptoJS.AES.encrypt(user.name, "Secret Passphrase");
        callback(err, encrypt);
    })
};

var submit_postsurvey = function(channel_id, username, callback){
    Channel.findOne({"_id":channel_id}, function(err, channel){
        if(err || !channel)
            return;
        if(!err){
            var count = 0;
            channel.participants.forEach(participant => {
                if(participant.name == username)
                    participant.postsurvey = true;
                if(participant.postsurvey == true)
                    count += 1;
            })
            Channel.updateOne({"_id":channel_id}, {$set:{participants:channel.participants}},{upsert:true}, function(){});
            callback(err, count, channel.duration);
        }
    })
};

var complete_experiment = function(channel_id, username, callback){
    Channel.findOne({"_id":channel_id}, function(err, channel){
        if(err)
            callback(err);
        var postsurvey = 0;
        for(var i = 0; i < channel.participants.length; i ++){
            if(channel.participants[i].postsurvey == true)
                postsurvey += 1;
        };
        var now = new Date();
        var start = new Date(channel.started_at);
        //var duration = (now - start - 1000*60*60) / (1000*60);
        var duration = (now - start - 1000*60*60*4) / (1000*60);
        Channel.updateOne({"_id":channel_id},
            {$set:{type: "result", participants: channel.participants, duration: duration.toFixed(2)}}, {upsert:true}, function(err1){
                if(err1)
                    callback(err1);
            });
        callback(err, "Finished", postsurvey, duration.toFixed(2));
    })  
};

var assign_account = function(callback){
    User.find({"experiment": true}, function(err, users){
        if(err)
            callback(err);
        var name_array = [];
        var name;
        var password = parseInt(Math.random()*10000000);
        users.forEach(user => {
            name_array.push(user.name);
        })
        while (true){
            name = "tester-"+parseInt(Math.random()*100000000);
            if(name_array.includes(name) == false)
                break;
        }
        var new_user = new User({'name':name, 'password': password, 'channels': [], "experiment": true, "channel":[], "newcoming":true});
        new_user.save().then(function(){
            new_user.password = password;
            callback(err, new_user);
        });
    });
};

var store_channel_presurvey = function(channel_id, username, callback){
    Channel.findOne({"_id":channel_id}, function(err, channel){
        if(err)
            callback(err);
        channel.participants.forEach(participant => {
            if(participant.name == username)
                participant.presurvey = true;
        });
        Channel.updateOne({"_id":channel_id}, {$set:{participants: channel.participants}}, {upsert:true}, function(){});
        callback(err,channel);
    })
};

var search_code = function(code, callback){
    var decrypted = CryptoJS.AES.decrypt(code, "Secret Passphrase");
    User.findOne({"name": decrypted.toString(CryptoJS.enc.Utf8)}, function(err1, user){
        if(err1)
            return callback(err1);
        if(!user){
            return callback("Invalid Survey Code.");
        }
        Survey.findOne({"user": user._id}, function(err, survey){
            if(err)
                return callback(err);
            var pre_survey = {};
            survey.pre_survey.forEach(dict => {
                pre_survey[dict.name] = dict.answer;
            });
            var post_survey = {};
            survey.post_survey.forEach(dict => {
                post_survey[dict.name] = dict.answer;
            });
            callback(err, JSON.stringify(pre_survey), JSON.stringify(post_survey));
        })
    })
};

var individual_info = function(callback){
    Survey.find({}, function(err,results){
        if(err) 
            return console.log(err)
        callback(err, results);
    })
};

var reset_newcoming = function(user_id){
    User.updateOne({"_id":user_id}, {$set:{newcoming:false}}, {upsert:true}, function(){});
};

var get_exp_channels = function(callback){
    Channel.find({$or:[{'type':"experiment"}, {'type':"in progress"}, {'type':"result"}]},function(err, channels){
        callback(channels);
    });
};


exports.get_user = get_user;
exports.create_user = create_user;
exports.get_all_channels = get_all_channels;
exports.get_all_messages = get_all_messages;
exports.create_channel = create_channel;
exports.join_channel = join_channel;
exports.get_messages_by_channel = get_messages_by_channel;
exports.get_usernames = get_usernames;
exports.create_message = create_message;
exports.get_channel_by_name = get_channel_by_name;
exports.get_channel_by_id = get_channel_by_id;
exports.create_invite = create_invite;
exports.get_invite = get_invite;
exports.likes = likes;
exports.add_online_users = add_online_users;
exports.sub_online_users = sub_online_users;
//exports.user_join_channel = user_join_channel;
exports.bookmark = bookmark;
//exports.bookmark_list = bookmark_list;
exports.create_exp_channel = create_exp_channel;
exports.configure_exp_channel = configure_exp_channel;
exports.get_all_exp_channels = get_all_exp_channels;
exports.sub_group = sub_group;
exports.edit_content = edit_content;
exports.modify_hierarchy = modify_hierarchy;
exports.get_channel = get_channel;
exports.get_email = get_email;
exports.compare_token = compare_token;
exports.change_password = change_password;
exports.get_content = get_content;
exports.update_survey = update_survey;
exports.get_available_channels = get_available_channels;
exports.register = register;
exports.store_presurvey = store_presurvey;
exports.start_experiment = start_experiment;
exports.get_user_presurvey = get_user_presurvey;
exports.store_postsurvey = store_postsurvey;
exports.complete_experiment = complete_experiment;
exports.submit_postsurvey = submit_postsurvey;
exports.assign_account = assign_account;
exports.store_channel_presurvey = store_channel_presurvey;
exports.search_code = search_code;
exports.individual_info = individual_info;
exports.reset_newcoming = reset_newcoming;
exports.get_exp_channels = get_exp_channels;
