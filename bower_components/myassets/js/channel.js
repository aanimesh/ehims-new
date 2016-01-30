
var socket;

var send_message = function () {
    $('#message').prop('disabled',true);

    // first we build the message
    var message = {
        'author'    : username,
        'channel'   : channel.name,
        'msg_parent': cur_root,
        'children'  : [], // can't have children yet...
        'content'   : $('#message').val()
    };
    
    // post to server as json
    // (server will broadcast)
    $.ajax({
        type : "POST",
        url  : '/message',
        data : JSON.stringify(message),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
    }).always(function(){
        $('#message').val('');
        $('#message').prop('disabled',false);
    });
};

var make_msg_div = function(msg){
    var class_str="message "; 
    class_str += msg.author===username?"message-user":"message-other";
    var msg_div = $("<div>",{class: class_str}); 
    msg_div.append("<p>"+msg.content.replace("\n","<br/>")+"</p>");
    msg_div.append('<div class="info">'+msg.author+'</div>');
    return msg_div;
};

var receive_msg = function(msg){
    messages[msg._id] = msg;
    if(msg.msg_parent){
        messages[msg.msg_parent._id].children.push(msg);
        if(cur_root && msg.msg_parent._id === cur_root._id){
            $('#messages-view').append(make_msg_div(msg));
        }
    } else {
        // then msg is a top_lvl message
        if (!cur_root){
            $('#messages-view').append(make_msg_div(msg));
       }
        channel.top_lvl_messages.push(msg);
    }
};


$(document).ready(function(){
    var q = "username="+username+"&channel="+channel.name;
    socket = io('http://127.0.0.1:3000/', {query:q});
    socket.on('message',receive_msg);

    $('#message-send').on('click',send_message);

});

