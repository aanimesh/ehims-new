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
            io.to(q.channel).emit('log-on',q.username);
        
            socket.on('disconnect', function(){
                console.log(q.username+" left "+q.channel);
                io.to(q.channel).emit('log-off',q.username);
                storage.get_or_create_user(q.username,function(user){
                    storage.get_channel_by_id(q.channel,function(channel){
                        channel.log_user_out(user);
                    });
                });
            });
        
        },
    };

    return methods;
};

