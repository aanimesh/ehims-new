// storage.js
// Author: Amiel Kollek <a_kollek@live.ca>
// ---------------------------------------
// 
// This file contains all code needed for
// interfacing with the database


var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var _mongo_url = 'mongodb://localhost:27017/ehims';
var jQuery = require('jquery');


// Users and Channels
// ------------------
//
// user model : {
//  _id : "Name",
//  channels : [],
// }
//
// channel model : {
//  _id : "Name",
//  online_users : [],
//  top_lvl_messages : []
// }

/**
 * Get or create user
 * @param {string} username
 * @param {function} callback, to be called with user document
 * @returns {Object} User
 */
exports.get_or_create_user = function(name,callback){
    var find_user = function(db){
        var user;
        var docs = db.collection('users').find({"_id": name}).toArray();
        if(docs.length > 0){
           user = docs[0];
        } else {
            user = { "_id": name, "channels": []};
            db.collection('users').insertOne(user);
        }
        return user;
    };

    MongoClient.connect(_mongo_url, function(err, db) {
          assert.equal(null, err);
          var user = find_user(db);
          db.close();
          callback(user);
    });


};

/**
 * get channels
 * @returns {Array} channels
 */
exports.get_channels = function(){
    var channels = [];
    var find_channels = function(db){
       return db.collection('channels').toArray();
    };

    MongoClient.connect(_mongo_url, function(err, db) {
          assert.equal(null, err);
          channels = find_channels(db);

          db.close();
    });

    return channels;
};


/**
 * join or create channel
 * @param {Object} User
 * @param {string} channel name
 * @returns {Object} channel
 */
exports.join_or_create_channel = function(user,channel_name){
    var channel;
    var find_channel = function(db){
        var docs = db.collection('channels').find({"_id": channel_name}).toArray();
        if(docs.length > 0){
           channel = docs[0];
        } else {
            channel = { "_id": channel_name, "ol_users": [], "tl_msgs": []};
            db.collection('channels').insertOne(channel);
        }
    };

    // join the channel if not in it already
    if(jquery.inArray(channel_name, user.channels) === -1)    
        user.channels.push(channel_name);

    MongoClient.connect(_mongo_url, function(err, db) {
          assert.equal(null, err);
          find_channel(db);

          db.close();
    });
    
    return channel;
};
    


