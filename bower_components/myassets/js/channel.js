
var socket;

var send_message = function () {
    // first we build the message
    var message = {
        'author'    : username,
        'channel'   : channel,
        'msg_parent': cur_root,
        'children'  : [], // can't have children yet...
        'content'   : $('#message').val()
    };
    
    // post to server as json
    // (server will broadcast)
    $.ajax({
        type : "POST",
        url  : '/channels/'+channel+'/messages',
        data : JSON.stringify(message),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
    }).always(function(){
        $('#message').val('');
    });
};



$(document).ready(function(){
    var q = "username="+username+"&channel="+channel;
    socket = io('http://127.0.0.1:3000/', {query:q});
});

