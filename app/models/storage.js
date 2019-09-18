// storage.js
// Author: Amiel Kollek <a_kollek@live.ca>
// ---------------------------------------
// 
// This file contains all code needed for
// interfacing with the database


var MongoClient = require('mongodb').MongoClient;
var mongoose = require('mongoose');
var assert = require('assert');
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
    var user = new User({'name':user, 'password': pass, 'channels': [],
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
        var invite = new Invite({
            'channel': channel,
        });
        invite.save();
        callback(invite);
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
            if(channel.participants == null || channel.participants == undefined)
                callback(err, null);
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
         });
    });
}

var sub_online_users = function(channel_id, username, callback){
    get_user(username, function(err, user){
        get_channel_by_id(channel_id, function(channel){
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

/*var bookmark_list = function(username, callback){
    get_user(username, function(err, user){
        var results = [];
        user.bookmarked.forEach(function(msg){
            results.push(msg._id);
        });
        callback(err, results);
    })
}*/

var create_exp_channel = function(time, callback){
    var group_no = 0;
    Channel.count({'type': 'experiment'}).then(function(count){group_no = count+1});

    channel = new Channel({'name': 'tmpname-exp-'+time,
                     'chat_type': 'tree',
                     'participants': [],
                     'type': 'experiment',
                     'group_no': group_no,
                     'users_number': null,
                     'top_lvl_messages': []});
    channel.save().then(function(channel){
        callback(null, channel._id, group_no)});
};

var configure_exp_channel = function(data, callback){
    var channel_name = 'experiment-'+data['channel_id'];
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
    var invite = new Invite({'channel': data['channel_id']});
    invite.save().then(function(invite){
        Channel.update({'_id':data['channel_id']},{ $set:{
            tree_views:data['tree_views'],
            started_at:data['time'],
            chat_type:data['chat_type'],
            name: channel_name,
            users_number: parseInt(data['number']),
            group_no: data['group_no'],
            invite_link: invite,
        }}, {upsert:true}, function(err){
            Channel.findOne({'_id': data['channel_id']}, function(err, channel){
                callback({'invite':invite._id, 'channel': channel});
            });
        });
    });
};

var get_all_exp_channels = function(callback){
    Channel.deleteMany({'name':{ $regex: /tmpname-exp-/, $options: 'i' }}).then(function(){
        Channel.find({'type':"experiment"},function(err, channels){
            callback(channels);
        });
    });
};

var sub_group = function(){
    Channel.findOne({"type" : "experiment"}).sort({created_at: -1}).exec(function(err, channel){
        Channel.update({"_id":channel._id}, {$set:{type: 'routine', group_no: ''}}, {upsert:true}, function(){});
    });
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
    Message.findOne({"_id": child_id},function(err, cmsg){
        if(cmsg.msg_parent != null && cmsg.msg_parent != undefined){
            Message.findOne({"_id":cmsg.msg_parent}, function(err, op){
                op.children = op.children.filter(child => child != child_id);
                Message.updateOne({"_id":cmsg.msg_parent},{$set:{children: op.children}}, {upsert:true}, function(){});
            });
            if(cmsg.other_parents != undefined){
                cmsg.other_parents.forEach(function(other_parent){
                    Message.findOne({"_id":other_parent}, function(err, op1){
                        op1.children = op1.children.filter(child => child != child_id);
                        Message.updateOne({"_id":other_parent},{$set:{children: op1.children}}, {upsert:true}, function(){});
                    });
                });
            }
        }else{
            Channel.findOne({"_id":channel_id},function(err, channel){
                channel.top_lvl_messages = channel.top_lvl_messages.filter(msg => msg != child_id); 
                Channel.updateOne({"_id": channel_id}, {$set:{top_lvl_messages: channel.top_lvl_messages}}, {upsert:true}, function(){});
            })
        }
        
        var msg_parent = null;
        var other_parents = [];
        if(change_parents[0] == "0"){
            Channel.findOne({"_id": channel_id}, function(err, channel){
                var seen = 0;
                channel.top_lvl_messages.forEach(function(m){
                    if (m == cmsg)
                        seen = 1;
                });
                if (seen == 0)
                    Channel.updateOne({"_id": channel_id}, {$push:{top_lvl_messages: mongoose.Types.ObjectId(child_id)}}, {upsert:true}, function(){});
            });
        }else{
            //change_parents = change_parents.filter(msg => msg != "0");
            var bulkOps = [];
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

            Message.bulkWrite(bulkOps)
                .then( bulkWriteOpResult => {
                    console.log('Hierarchy changed');
                })
                .catch( err => {
                    console.log('Hierarchy failed to change');
                });
        };
        Message.updateOne({"_id":child_id},{$set:{msg_parent:msg_parent, other_parents:other_parents}, $push:{original_version: data.record}}, {upsert:true}, function(){});
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
