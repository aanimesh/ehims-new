
var cur_root = null;
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
        $('#message').focus();
    });
};

var new_message_flash;

var message_flash = function(){
    var envelope = $('a#mail i')[0];
    envelope.className = 
        envelope.className === "fa fa-envelope" ? 
        "fa fa-envelope-o" : "fa fa-envelope";
};

var update_queue_display = function(){
    $('#queue-length').html('('+queue.length+')');
    if(queue.length === 0 ){
        var envelope = $('a#mail i')[0];
        envelope.className = "fa fa-envelope";
        clearTimeout(new_message_flash);
    }
};


var add_msg_to_hover_list = function(msg){
    $('#new-msg-list').prepend('<li id="list-'+
            msg._id +'">'+
            msg.author + ': ' +
            msg.content.substring(0, 
                (25-msg.author.length)>0? 25-msg.author.length : 0) +
            '</li>');
    $('#list-'+msg._id).on('click', function(){show_msg(msg);});
};


var receive_msg = function(msg){
    messages[msg._id] = msg;
    if(msg.msg_parent)
        messages[msg.msg_parent].children.push(msg._id);
    else
        channel.top_lvl_messages.push(msg._id);
    if(msg.author !== username){
        queue.push(msg);
        $('#queue-length').html('('+queue.length+')');
        clearInterval(new_message_flash);
        new_message_flash = setInterval(message_flash, 700);
    }
    if(tree){
        tree.destroy();
    }
    // add the message to the tree_data and display
    tree_data.nodes.push(new Node(msg._id, msg.content.substr(0,5)+'...'));
    var msg_parent = msg.msg_parent ? msg.msg_parent : '0';
    tree_data.edges.push(new Edge(msg_parent,msg._id));
    display_tree();
    if(msg.author === username)
        show_msg(msg,true);
    else
        add_msg_to_hover_list(msg);

};

var next_msg = function(){
    if(queue.length === 0) return;
    var msg = queue.shift();
    show_msg(msg);
}; 

var get_path_to_root = function (msg){
    var ret = [];
    if(msg){
        ret = get_path_to_root(messages[msg.msg_parent]);
        ret.push(msg);
    }
    return ret;
};


// show the next message
var show_msg = function(msg){

    reply(msg._id);

    //if(msg.msg_parent){
    //    // if the parent message is in view, then increment it's reply count
    //    if($('#'+msg.msg_parent).length > 0){
    //        $('#'+msg.msg_parent)
    //            .find('.rcnt')
    //            .html('('+messages[msg.msg_parent].children.length+')');
    //    }

   //     if(cur_root && msg.msg_parent._id === cur_root._id){
   //         $('#messages-view').append(make_msg_div(msg));
   //     }
   //} else {
   //     // then msg is a top_lvl message
   //     if (!cur_root){
   //         $('#messages-view').append(make_msg_div(msg));
   //    }
   //}
   // $('a.reply').on('click',function(){
   //     reply($(this).closest('.message').attr('id'));
   // });
   //
   
    // if in queue, remove
    remove_from_queue(msg._id);
    seen.push(msg);
    
    var messages_view = document.getElementById("messages-view");
    messages_view.scrollTop = messages_view.scrollHeight;

};

var remove_from_queue = function(id){
    var i;
    for(i=queue.length-1;i>=0;i--){
        if (queue[i]._id === id){
            queue.splice(i,1);
            break;
        }
    }
    var queue_list = $('#new-msg-list').children();
    for(i=queue_list.length-1;i>=0;i--){
        if($(queue_list[i]).attr('id') === ('list-'+id)){
            $(queue_list[i]).remove();
            break;
        }
    }
    update_queue_display();
};

var make_msg_div = function(msg){
    var class_str="message ",info_div; 
    //class_str += msg.author===username?"message-user":"message-other";
    var msg_div = $("<div>",{class: class_str, id: msg._id});  
    msg_div.css({'background-color':get_colour(msg.author)});
    msg_div.append("<p>"+msg.content.replace("\n","<br/>")+"</p>");
    info_div = '<div class="info">'+msg.author+' | ';
    info_div += 'Replies: '+msg.children.length; 
    info_div += '</div>';
    msg_div.append(info_div);
    return msg_div;
};

// navigating functions

var reply = function(id){
    var root = messages[id];
    cur_root = id;
    console.log("set cur_root to: " + cur_root);
    // show slection on tree
    tree.selectNodes([id]); 
    display_path_to_root(id);
    //change_view_root(id);
    var className = " message-selected";
    $('#'+id)[0].className += className;
    $('#message').trigger("focus");
};

var display_path_to_root = function(id){
    if(id === "0")
        go_to_root();
    else{
        var path = get_path_to_root(messages[id]);
        //only display the previous ten messages
        if(path.length>10) path = path.slice(path.length-10,path.length);
        var msg_view = $('#messages-view');
        var msg_div;

        msg_view.empty();
        for(var i=0, len = path.length; i<len; i++){
            msg_div = make_msg_div(path[i]);
            //msg_div.css('opacity', i === len-1 ? '1':'0.'+(i+1+(10-len)));
            msg_div.css('opacity', len=== 1 ? '1' : String((i+1)/len));
            msg_view.append(msg_div);
        }
        $('.message').on('click',function(){
            reply($(this).attr('id'));
        });
    }
};



var change_view_root = function(id){ // change root
    if(id === "0")
        go_to_root();
    else {
        var view_root = messages[id];
        var msg_view = $('#messages-view');
        msg_view.empty();
        msg_view.append(make_msg_div(view_root));
        for(var i = 0, len = view_root.children.length; i<len; i++){
            msg_view.append(make_msg_div(messages[view_root.children[i]]));
        }
        $('.message').on('click',function(){
            reply($(this).attr('id'));
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
    $('.message').on('click',function(){
        reply($(this).attr('id'));
    });
}; 

var back = function(){ // when back arrow is clicked
    // This version of back goes to the previous node in the tree:
    // if at root, logout and go to channels page
//    if(!cur_root){
//        // logout();
//        $('form#back-form input').val(username);
//        $('#back-form').submit();
//    } else {
//        if(messages[cur_root].msg_parent === null)
//            go_to_root();
//        else 
//            reply(messages[cur_root].msg_parent);
//    }

    // This version of back goes to the last seen 
    if(seen.length > 0){
        queue.unshift(seen.pop());
        if(seen.length > 0)
            reply(seen[seen.length-1]._id);
        else
            go_to_root();
        update_queue_display();
    }

};

var enter_on_message = function(e){
    var code = e.keyCode || e.which;
    switch(code){
        case 13:
            if($('#message').val().trim())
                // not empty, so send message
                send_message();
            else{
                next_msg();
                $('#message').val('');
                e.preventDefault();
            }
            return;
        case 39:
            next_msg();
            $('#message').val('');
            e.preventDefault();
            return;
        case 37:
            back();
            return;
        default:
            return;
    }
};

var user_log_on = function(uname){
    if(uname !== username){
        // first assign a colour
        var pos = online.length;
        online.push({name:uname, colour: colours[colour_pos %57]});
        colour_pos += 7;

        $('#online-users').append(
            '<li style="color:'+
            online[pos].colour+
            ';">'+uname+'</li>');
    }
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
    tree.on('select',function(p){ reply(p.nodes[0]);});
};

var assign_colour = function(){
    for (var i = online.length-1; i>=0 ; i--){
        online[i].colour = colours[colour_pos % colours.length];
        // increase by  so multiple users aren't too close 
        // together. 7 chosen to be coprime ot length of
        // colours (57) so that all colours are visited before
        // a repeated colour.
        colour_pos += 7; 
    }
};


var update_online = function(){
    $('#online-users').html('');
    for (var i = online.length-1; i>=0 ; i--){
        $('#online-users').append(
                '<li style="color:'+
                online[i].colour+
                ';">'+online[i].name+'</li>');
    }
};

var get_colour = function(uname){
    for (var i = online.length-1; i>=0 ; i--){
        if(online[i].name === uname){
            return online[i].colour;
        }
    }
    return "#000";
};

$(document).ready(function(){
    var q = "username="+username+"&channel="+channel.name;
    socket = io(socket_url, {query:q});
    socket.on('message',receive_msg);

    socket.on('log-on',user_log_on);
    socket.on('log-off',user_log_off);

    $('#message-send').on('click',send_message);
    $('.message').on('click',function(){
        console.log('clicked');
        reply($(this).attr('id'));
    });
    $('#channel-name').on('click',go_to_root);
    $('#back-arrow').on('click',back);

    $('a#mail').on('click',next_msg);
    
    $('textarea#message').on('keydown',enter_on_message);


    assign_colour();

    update_online();


    build_tree();
    display_tree();
    $('#message').focus();

    if(queue.length > 0){
        new_message_flash = setInterval(message_flash, 700);
        for(var i=queue.length-1;i>=0;i--){
            add_msg_to_hover_list(queue[i]);
        }
    }


});

