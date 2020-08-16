// io.js
// -----
// Author: Amiel Kollek <a_kollek@live.ca>
//


var storage = require('../models/storage.js');

module.exports = function(io){

    methods = {
        connection : function(socket){
            var q = socket.handshake.query;
            console.log(q);
            if(q.admin == "admin"){
                socket.join('admin');
            }
            else if(q.channel == undefined || q.channel == null)
                socket.join('scheduler');
            else if(q.username != undefined && q.username != null){
                console.log(q.username+" connected to "+q.channel);
                storage.add_online_users(q.channel, q.username, function(err, participants){
                    if (err)
                        console.log(err.message);
                    if(!err && participants){
                        socket.join(q.channel);
                        io.to(q.channel).emit('log-on',q.username, participants);
                    }
                });
            
                socket.on('disconnect', function(){
                    console.log(q.username+" left "+q.channel);
                    storage.sub_online_users(q.channel, q.username, function(err, participants){
                        if(!err && participants)
                            io.to(q.channel).emit('log-off',q.username, participants);
                    });
                });
            }
        },  
    };

    return methods;
};

