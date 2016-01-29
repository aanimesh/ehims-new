// io.js
// -----
// Author: Amiel Kollek <a_kollek@live.ca>
//

var connection = function(socket){
    var data = { 'username' : socket.handshake.query.username,
                 'channel'  : socket.handshake.query.channel
    };
    console.log(data.username+" connected to "+data.channel);
};


exports.connection = connection;
