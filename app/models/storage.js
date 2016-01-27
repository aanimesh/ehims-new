// storage.js
// Author: Amiel Kollek <a_kollek@live.ca>
// ---------------------------------------
// 
// This file contains all code needed for
// interfacing with the database


var MongoClient = require('mongodb').MongoClient;
var mongoose = require('mongoose');
var assert = require('assert');
var _mongo_url = 'mongodb://localhost:27017/ehims';

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
        if(!user)
            user = new User({'name':name, channels: []});
        callback(user);
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
        if(!channel)
            channel = new Channel({'name': channel_name,
                                   'online_users': [],
                                   'top_lvl_messages': []});
        user.join_channel(channel);
        channel.log_user_in(user);
        callback({'user':user,'channel':channel});
    });
};
    
exports.get_or_create_user = get_or_create_user;
exports.get_channels = get_channels;
exports.join_or_create_channel = join_or_create_channel;

