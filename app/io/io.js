// io.js
// -----
// Author: Amiel Kollek <a_kollek@live.ca>
//

var connection = function(socket){
    var q = socket.handshake.query;
    console.log(q.username+" connected to "+q.channel);
    socket.join(q.channel);

};


exports.connection = connection;
