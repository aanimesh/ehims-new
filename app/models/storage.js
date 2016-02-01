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

mongoose.connect(_mongo_url);

// load models
var User = require('./user.js').User;
var Channel = require('./channel.js').Channel;
var Message = require('./message.js').Message;

/**
 * Get or create user
 * @param {String} username
 * @param {function} callback, to be called with user document
 */
var get_or_create_user = function(name,callback){

    User.findOne({'name': name},function(err, user){
        assert.equal(null, err);
        if(!user){
            user = new User({'name':name, channels: []});
            user.save();
        }
        callback(user);
    });
};

/**
 * get channel by name
 * @param {String} channel id
 * @param {function} callback to be called on channel name
 */
var get_channel_by_name = function(channel_name, callback){
    Channel.findOne({ 'name': channel_name },function(err, channel){
        assert.equal(null, err);
        callback(channel);
    });
};

/**
 * get channels
 * @param {function} callback to be called on list of channel names
 */
var get_channels = function(callback){
    Channel.find({},function(err, channels){
        assert.equal(null, err);
        channel_names = [];

        channels.forEach(function(channel){
            channel_names.push(channel.name);
        });

        callback(channel_names);
    });
};


/**
 * join or create channel
 * @param {Object} User
 * @param {String} channel name
 * @param {function} callback to be called on {user, channel}
 */
var join_or_create_channel = function(user, channel_name, callback){
    
    Channel.findOne({'name':channel_name},function(err, channel){
        assert.equal(null,err);
        if(!channel){
            channel = new Channel({'name': channel_name,
                                   'online_users': [],
                                   'top_lvl_messages': []});
            channel.save();
        }
        user.join_channel(channel);
        channel.log_user_in(user);
        callback({'user':user,'channel':channel});
    });
};
    

/**
 * Get users
 * @param {Array} Array of user ids
 * @param {function} callback to be called on [usernames]
 */

var get_usernames = function(ids, callback){
    User.find({
        '_id' : { $in : ids }
    }, function(err, users){
        assert.equal(null, err);
        var user_list = [];
        users.forEach(function(u){user_list.push(u.name);});
        callback(user_list);
    });
};

/**
 * Get messages by channel
 * @param {String} channel id
 * @param {function} callback to be called on { message_id : message, ... }
 */

var get_messages_by_channel = function(channel, callback){
    Message.find({
        channel : channel
    }, function(err, message_objs){
        assert.equal(null, err);
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
        assert.equal(null, err);
        callback(message);
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
        get_channel_by_name(message.channel,function (channel){
            channel.top_lvl_messages.push(message._id);
            channel.save();
            callback(message);
        });
    } else {
        get_message(message.msg_parent,function(p){
            p.children.push(message._id);
            p.save();
            callback(message);
        });
    }
};

exports.get_or_create_user = get_or_create_user;
exports.get_channels = get_channels;
exports.join_or_create_channel = join_or_create_channel;
exports.get_messages_by_channel = get_messages_by_channel;
exports.get_usernames = get_usernames;
exports.create_message = create_message;
exports.get_channel_by_name = get_channel_by_name;
