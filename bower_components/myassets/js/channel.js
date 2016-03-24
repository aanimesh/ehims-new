
// should be "hard_focus"
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
        'content'   : $('#message').val().replace('&','&amp;')
                                         .replace('<','&lt;')
                                         .replace('>','&gt;')
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
    $('#new-msg-list').empty();
    for(i=queue.length-1;i>=0;i--)
        add_msg_to_hover_list(queue[i]);

    // now fix the progress bar
    var percent = Math.ceil(100*seen.length/(queue.length + seen.length));
    document.getElementById('progress-bar').style.width = percent + '%';
};


var add_msg_to_hover_list = function(msg){
    $('#new-msg-list').prepend('<li id="list-'+
            msg._id +'">'+
            msg.author + ': ' +
            msg.content.substring(0, 
                (25-msg.author.length)>0? 25-msg.author.length : 0) +
            '</li>');
    $('#list-'+msg._id).on('click', function(){reply(msg._id);});
};


var receive_msg = function(msg){
    messages[msg._id] = msg;
    ids[msg._id] = cur_id;
    cur_id++;

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
        reply(msg._id);
    else
        add_msg_to_hover_list(msg);

};

var next_msg = function(){
    if(queue.length === 0) return;
    reply(queue[0]._id);
}; 

// this method does not include the message it was called on
var get_path_to_root = function (msg){
    var ret = [];
    msg = messages[msg.msg_parent];
    while(msg){
        ret.unshift(msg);
        msg = messages[msg.msg_parent];
    }
    return ret;
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
    var wrapper = $("<div>",{class: 'message-wrapper', id: msg._id+'-wrapper'});
    var d = new Date(msg.created_at);
    var date = d.getHours()+":"+d.getMinutes()+" "+d.toDateString();
    var msg_div = $("<div>",{class: class_str, 
        id: msg._id, 
        author: msg.author,
        created_at: date,
        replies: msg.children.length,
        user_visible_id: ids[msg._id]});  
    msg_div.css({'background-color':get_colour(msg.author)});
    msg_div.append("<p>"+msg.content.replace("\n","<br/>")+"</p>");
    wrapper.append(msg_div);
    wrapper.append('<div class="plus-minus-button"><i class="fa fa-plus"></i></div>');
    wrapper.append($("<ul>",{class: 'reveal-children',style: "display:none;"}));
    return wrapper;
};

// navigating functions

// maybe this should be renamed to "set focus"
// This function takes an id and sets that message to the focal message,
// also popping and displaying all siblings in the process
var reply = function(id){
    if(id === "0") return;
    var root = messages[id];
    cur_root = id;
    // show slection on tree
    display_path_to_root(id);
    //change_view_root(id);
    
    //display_siblings(id);
    display_message(id);

    // add listeners
    $('.message').on('click',function(){
        reply($(this).attr('id'));
    });


    // handle children reveal
    $('.plus-minus-button').on('click',function(){
        var id = $(this).parent().find('.message').attr('id');
        // toggle symbol
        $(this).find('i').attr('class',
            $(this).find('i').attr('class').indexOf('plus')>-1 ? 
            'fa fa-minus':'fa fa-plus');
        var list = $(this).parent().closest('div').find('.reveal-children');
        // if not filled, update
        if(list.is(':empty')){
            var make_bind_func = function(this_id){
                return function(){reply(this_id);};
            };
            var children = messages[id].children;
            var listitem;
            for(var i=0,len=children.length; i<len;i++){
                listitem = $("<li>", {
                    class: "child-message",
                    id: messages[children[i]]._id+'-wrapper'
                });
                listitem.css({
                    'background-color': get_colour(messages[children[i]].author)
                });
                listitem.html(
                    messages[children[i]].author +': '+
                    messages[children[i]].content);
                list.append(listitem);
                $('#child-'+messages[children[i]]._id).on('click',
                   make_bind_func(messages[children[i]]._id) );
            }
        }
        list.slideToggle('fast');

    });

    // remove siblings from queue
    // uncomment if using display_siblings
    //var siblings;
    //if(!(id === "0" || messages[id].msg_parent === null)){
    //    siblings = messages[messages[id].msg_parent].children;
    //} else{
    //    siblings = channel.top_lvl_messages;
    //}

    //var siblings_set = new Set(siblings);
    //for(var i=0, len=queue.length; i<len; i++){
    //    if(siblings_set.has(queue[i]._id)){
    //        seen.push(queue.splice(i,1)[0]);
    //        i--;
    //        len -= 1;
    //    }
    //}
    //tree.selectNodes(siblings); 
    
    // remove self from queue
    for(var i=0, len=queue.length; i<len; i++){
        if(queue[i]._id === id){
            seen.push(queue.splice(i,1)[0]);
            break;
        }
    }

    tree.selectNodes([id]);
    update_queue_display();

    $('#message').trigger("focus");

    //automatically expand children
    setTimeout(function() {
        $('#'+id+'-wrapper .plus-minus-button').trigger("click");
    },250);

    // set soft focus arrow
    set_soft_focus(id);

    // check to make sure displayed message is in view
    var messages_view = document.getElementById("messages-view");
    messages_view.scrollTop = // messages_view.scrollHeight;
            $('#'+id+'-wrapper').position().top;
};

// get the id of the current soft focus message wrapper
var get_soft_focus = function(){
    var id = $('#selected-arrow').parent().attr('id');
    return id.substr(0,id.length-8); // strip the "-wrapper" 
};

// places the soft-focus arrow on the div of message_id 'id'
var set_soft_focus = function (id){
    // first remove margin from current soft focus
    var cur_soft = $('#selected-arrow').parent().attr("id");
    $('#'+cur_soft).css({'margin-left':''});
    $('#'+cur_soft + ' ul.reveal-children').css({'margin-left':'20px'});
    


    // delete current arrow
    $('#selected-arrow').remove();

    // add the new one
    $('#'+id+'-wrapper').prepend(
            '<div id="selected-arrow">'+
                '<i class="fa fa-arrow-right"></i>'+
            '</div>');
    // fix indenting
    var arrow_width = $('#selected-arrow').width();
    var new_margin = ( (id===cur_root) ? 20 : 0) -$('#selected-arrow').width();
    $('#'+id+'-wrapper').css({
        'margin-left':(((id===cur_root) ? 20 : 0) - arrow_width) +'px'
    });
    $('#'+id+'-wrapper ul.reveal-children').css({
        'margin-left': 20+arrow_width+'px'});
};

// moves the soft-focus arrow visually up on screen
var arrow_up = function(){
    /* three cases:
     *  1 -> child
     *      two sub cases:
     *       a -> top child: go to hard focus
     *       b -> else: go to prev child
     *  2 -> on path to root: go to parent
     *  3 -> root: do nothing
     */
    
    var soft_focus_wrapper = $('#selected-arrow').parent();
    var soft_focus_id = soft_focus_wrapper.attr("id");
    soft_focus_id = soft_focus_id.substr(0,soft_focus_id.length-8);
    if(soft_focus_wrapper.is('li')){
        var msg_parent = messages[soft_focus_id].msg_parent;
        var siblings = messages[msg_parent].children;
        if(siblings.indexOf(soft_focus_id) === 0)
            // case 1a
            set_soft_focus(cur_root);
        else {
            // case 1b
            set_soft_focus(siblings[siblings.indexOf(soft_focus_id)-1]);
        }
    } else 
        if(messages[soft_focus_id].msg_parent !== null)
           // case 2
           set_soft_focus(messages[soft_focus_id].msg_parent);
       
};

// moves the soft-focus arrow visually down on screen
var arrow_down = function(){
    /* two cases:
     *  1 -> child
     *      two subcases:
     *       a -> bottom child: do nothing
     *       b -> else: go to next child
     *  2 -> on path to root:
     *      two subcases:
     *       a -> hard focus node: go to first child if exists (display if needed)
     *       b -> go to child which is displayed
     */

    var soft_focus_wrapper = $('#selected-arrow').parent();
    var soft_focus_id = soft_focus_wrapper.attr("id");
    soft_focus_id = soft_focus_id.substr(0,soft_focus_id.length-8);
    if(soft_focus_wrapper.is('li')){
        var msg_parent = messages[soft_focus_id].msg_parent;
        var siblings = messages[msg_parent].children;
        if(siblings.indexOf(soft_focus_id) !== (siblings.length-1)){
            // case 1b
            set_soft_focus(siblings[siblings.indexOf(soft_focus_id)+1]);
        }
    } else {
        var children = messages[soft_focus_id].children;
        if(soft_focus_id === cur_root){
            //case 2a
            // expand children if needed
            if($('#'+soft_focus_id+'-wrapper div.plus-minus-button i')
                    .attr('class')
                    .indexOf('minus') === -1){
                $('#'+soft_focus_id+'-wrapper .plus-minus-button').trigger("click");
            }
            if(children.length > 0)
                set_soft_focus(children[0]);
        } else {
            // case 2b
            for(var i = children.length-1; i>=0; i--){
                if($('#'+children[i]).length !== 0){
                    set_soft_focus(children[i]);
                    break;
                    }
            }
        }
    }
};

// make soft focus the hard focal node
var descend_from_soft_focus = function(){
    reply(get_soft_focus());
};

// go to parent of soft focus
var ascend_from_soft_focus = function(){
    msg_parent = messages[get_soft_focus()].msg_parent;
    if(msg_parent !== null)
        reply(msg_parent);
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
            msg_div.css('opacity', String((i+1)/(len+1)));
            msg_view.append(msg_div);
        }
    }
};

/* No longer used 
 * Uncomment to show all siblings of the focal message
var display_siblings = function(id){
    var msg_div;
    var siblings;
    if(!(id === "0" || messages[id].msg_parent === null)){
        siblings = messages[messages[id].msg_parent].children;
    } else{
        siblings = channel.top_lvl_messages;
    }
    var msg_view = $('#messages-view');
    for(var i=0, len=siblings.length; i<len; i++){
        msg_div = make_msg_div(messages[siblings[i]]);
        msg_view.append(msg_div); 
    }

    for(i=0, len=siblings.length; i<len; i++){
        document.getElementById(siblings[i]+'-wrapper').className += 
            siblings[i] === id ? ' message-selected' : ' message-sibling';
    }
};
*/

var display_message = function(id){
    $('#messages-view').append(make_msg_div(messages[id]));
     document.getElementById(id+'-wrapper').className += ' message-selected';
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
    //cur_root = null;
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
        // get the id of the last seen message
        var id = seen[seen.length-1]._id;
        // get all of it's siblings
        var siblings;
        if(!(id === "0" || messages[id].msg_parent === null)){
            siblings = messages[messages[id].msg_parent].children;
        } else{
            siblings = channel.top_lvl_messages;
        }
    
        // remove all of it's siblings from seen and place them in the front of the queue
        var siblings_set = new Set(siblings);
        for(var i=0, len=seen.length; i<len; i++){
            if(siblings_set.has(seen[i]._id)){
                queue.unshift(seen.splice(i,1)[0]);
                i--;
                len -= 1;
            }
        }
        if(seen.length>0){
            reply(seen[seen.length-1]._id);
        }
        update_queue_display();
    }

};

var handle_keydown = function(e){
    var code = e.keyCode || e.which;
    // don't do anything if the user is typing
    if($('#message').val().trim()){
        if(code === 13) send_message();
        return;
    }
    switch(code){
        case 13: // enter
            next_msg();
            $('#message').val('');
            e.preventDefault();
            break;
        case 37: // left
            ascend_from_soft_focus();
            break;
        case 38: // up
            arrow_up();
            break;
        case 39: // right
            /* This is for the queue/seen behaviour
            next_msg();
            $('#message').val('');
            e.preventDefault();
            */
            descend_from_soft_focus();
            break;
        case 40: // down
            arrow_down();
            break;
        default:
            break;
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
                direction: 'UD',
                sortMethod: 'directed'
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

    $('#message-send').on('click',function(){
        if($('#message').val().trim())
            send_message();
        else
            next_msg();
    });

    $('.message').on('click',function(){
        console.log('clicked');
        reply($(this).attr('id'));
    });
    $('#channel-name').on('click',function(){cur_root=null;go_to_root();});
    $('#back-arrow').on('click',back);

    $('a#mail').on('click',next_msg);
    
    $('textarea#message').on('keydown',handle_keydown);


    assign_colour();

    update_online();


    build_tree();
    display_tree();
    $('body').on('click',function(){$('#message').focus();});
    $('#message').focus();

    if(queue.length > 0){
        new_message_flash = setInterval(message_flash, 700);
        for(var i=queue.length-1;i>=0;i--){
            add_msg_to_hover_list(queue[i]);
        }
    }

    // get things started with the first message
    next_msg();

});

