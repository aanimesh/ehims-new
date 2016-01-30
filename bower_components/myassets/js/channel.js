
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
    var class_str="message ",info_div; 
    class_str += msg.author===username?"message-user":"message-other";
    var msg_div = $("<div>",{class: class_str, id: msg._id}); 
    msg_div.append("<p>"+msg.content.replace("\n","<br/>")+"</p>");
    info_div = '<div class="info">'+msg.author+' | ';
    info_div += '<a class="reply"><i class="fa fa-reply"></i> ';
    info_div += 'Reply <span class="rcnt">('+msg.children.length +')';
    info_div += '</span></a></div>';
    msg_div.append(info_div);
    return msg_div;
};

var receive_msg = function(msg){
    messages[msg._id] = msg;
    if(msg.msg_parent){
        messages[msg.msg_parent].children.push(msg._id);

        // if the parent message is in view, then increment it's reply count
        if($('#'+msg.msg_parent).length > 0){
            $('#'+msg.msg_parent)
                .find('.rcnt')
                .html('('+messages[msg.msg_parent].children.length+')');
        }

        if(cur_root && msg.msg_parent._id === cur_root._id){
            $('#messages-view').append(make_msg_div(msg));
        }
    } else {
        // then msg is a top_lvl message
        if (!cur_root){
            $('#messages-view').append(make_msg_div(msg));
       }
        channel.top_lvl_messages.push(msg._id);
    }
    $('a.reply').on('click',reply);
};

var reply = function(){ // change root
    // get message id
    var root = messages[$(this).closest('.message').attr('id')];
    cur_root = root._id;
    var msg_view = $('#messages-view');
    msg_view.empty();
    msg_view.append(make_msg_div(root));
    for(var i = 0, len = root.children.length; i<len; i++){
        msg_view.append(make_msg_div(messages[root.children[i]]));
    }
    $('a.reply').on('click',reply);
};


var go_to_root = function(){ // change the chat to the root of the channel
    cur_root = null;
    var msg_view = $('#messages-view');
    msg_view.empty();
    var msg;
    for(var i = 0, len = channel.top_lvl_messages.length; i<len; i++){
        msg_view.append(make_msg_div(messages[channel.top_lvl_messages[i]]));
    }
    $('a.reply').on('click',reply);
}; 

$(document).ready(function(){
    var q = "username="+username+"&channel="+channel.name;
    socket = io('http://127.0.0.1:3000/', {query:q});
    socket.on('message',receive_msg);

    $('#message-send').on('click',send_message);
    $('a.reply').on('click',reply);
    $('#channel-name').on('click',go_to_root);

});

