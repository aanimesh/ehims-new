// io.js
// -----
// Author: Amiel Kollek <a_kollek@live.ca>
//


var storage = require('../models/storage.js');

module.exports = function(io){

    methods = {
        connection : function(socket){
            var q = socket.handshake.query;
            console.log(q.username+" connected to "+q.channel);
            socket.join(q.channel);
            //io.to(q.channel).emit('log-on',q.username);
            storage.add_online_users(q.channel, q.username, function(err, online_users){
                io.to(q.channel).emit('log-on',q.username, online_users);
            });
            
            socket.on('disconnect', function(){
                console.log(q.username+" left "+q.channel);
                storage.sub_online_users(q.channel, q.username, function(err, online_users){
                    io.to(q.channel).emit('log-off',q.username, online_users);
                });
            });
        },  
    };

    return methods;
};

