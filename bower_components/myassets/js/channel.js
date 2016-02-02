
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
    $('a.reply').on('click',function(){
        reply($(this).closest('.message').attr('id'));
    });
    if(tree){
        tree.destroy();
    }
    // add the message to the tree_data and display
    tree_data.nodes.push(new Node(msg._id, msg.content.substr(0,5)+'...'));
    var msg_parent = msg.msg_parent ? msg.msg_parent : '0';
    tree_data.edges.push(new Edge(msg_parent,msg._id));
    display_tree();
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

// navigating functions

var reply = function(id){ // change root
    if(id === "0")
        go_to_root();
    else {
        var root = messages[id];
        cur_root = root._id;
        var msg_view = $('#messages-view');
        msg_view.empty();
        msg_view.append(make_msg_div(root));
        for(var i = 0, len = root.children.length; i<len; i++){
            msg_view.append(make_msg_div(messages[root.children[i]]));
        }
        $('a.reply').on('click',function(){
            reply($(this).closest('.message').attr('id'));
        });
    }
};

var go_to_root = function(){ // change the chat to the root of the channel
    cur_root = null;
    var msg_view = $('#messages-view');
    msg_view.empty();
    var msg;
    for(var i = 0, len = channel.top_lvl_messages.length; i<len; i++){
        msg_view.append(make_msg_div(messages[channel.top_lvl_messages[i]]));
    }
    $('a.reply').on('click',function(){
        reply($(this).closest('.message').attr('id'));
    });
}; 

var back = function(){ // when back arrow is clicked
    // if at root, logout and go to channels page
    if(cur_root === null){
        // logout();
        window.location.replace('/channels?username='+username);
    } else {
        if(messages[cur_root].msg_parent === null)
            go_to_root();
        else 
            reply(messages[cur_root].msg_parent);
    }
};

var user_log_on = function(uname){
    if(uname !== username)
        $('#online-users').append('<li>'+uname+'</li>');
};

var user_log_off = function(uname){
    $('#online-users').find("li:contains('"+uname+"')")
                      .filter(function(){
                         return $(this).html() === uname;
                      }).remove();
};


// Tree View Code
// --------------

var tree_data, tree;

function Node(id, label){
    this.id    = id;
    this.label = label;
}

function Edge(from, to){
    this.from = from;
    this.to   = to;
}

var build_tree = function(){
    var msg;
    var root = new Node('0',channel.name); 
    var msg_array = Object.keys(messages);
    tree_data = {
    nodes: [],
    edges: []
    };
    tree_data.nodes.push(root);
    for(var i=0, len=msg_array.length; i<len; i++){
        msg = messages[msg_array[i]]; 
        tree_data.nodes.push(new Node(msg._id, msg.content.substr(0,5)+'...'));
        for(var j=0,leng=msg.children.length;j<leng; j++){
            tree_data.edges.push(new Edge(msg._id,msg.children[j]));
        }
    }

    for(i=0, len=channel.top_lvl_messages.length;i<len;i++){
        tree_data.edges.push(new Edge('0',channel.top_lvl_messages[i]));
    }

}; 

var display_node = function(params){
    console.log(params);
    var msg_id = params.nodes[0];
    var content = (msg_id === "0") ? '' : messages[msg_id].content;
    $('#content').html(content);
    $('#view').on('click',function(){reply(msg_id);});
};

var display_tree = function(){
    var container = document.getElementById('tree');
    var options = {
        layout: {
            hierarchical: {
                direction: 'UD'
            } 
        }
    };
    tree = new vis.Network(container, tree_data, options);
    tree.on('select',display_node);
};

$(document).ready(function(){
    var q = "username="+username+"&channel="+channel.name;
    socket = io(socket_url, {query:q});
    socket.on('message',receive_msg);

    socket.on('log-on',user_log_on);
    socket.on('log-off',user_log_off);

    $('#message-send').on('click',send_message);
    $('a.reply').on('click',function(){
        reply($(this).closest('.message').attr('id'));
    });
    $('#channel-name').on('click',go_to_root);
    $('#back-arrow').on('click',back);

    build_tree();
    display_tree();

});

