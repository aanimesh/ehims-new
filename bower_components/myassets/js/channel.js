
var hard_focus = null;
var most_recent = null;
var socket;
var keys = {};
var dropdown_delay = 250; // ms to children dropdown shows
var chat_type = channel.chat_type;
var other_parents = [];


// ------ General Utilities ---------

var send_message = function () {
    $('#message').prop('disabled',true);
    // first we build the message
    //    The parent will be different depending on the chat type
    var msg_parent, parents;
    switch(chat_type){
        case 'path':
            msg_parent = most_recent;
            parents = [];
            break;
        case 'tree':
            msg_parent = get_soft_focus();
            parents = [];
            break;
        case 'graph':
            msg_parent = get_soft_focus();
            parents = other_parents.slice();
    }

    if (parents.indexOf(msg_parent) > -1)
        parents.splice(parents.indexOf(msg_parent), 1);


    var message = {
        'author'    : username,
        'channel'   : channel._id,
        'msg_parent': msg_parent,
        'other_parents': parents,
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
        reset_other_parents();
        $('#message').val('');
        $('#message').prop('disabled',false);
        $('#message').focus();
    });
};


var receive_msg = function(msg){
    var i;
    messages[msg._id] = msg;
    ids[msg._id] = cur_id;
    dbid_to_userid[cur_id] = msg._id;
    cur_id++;
    most_recent = msg._id;

    if(msg.msg_parent)
        messages[msg.msg_parent].children.push(msg._id);
    if(chat_type === 'graph' && msg.other_parents)
        for(i = msg.other_parents.length-1; i >= 0; i--)
           messages[msg.other_parents[i]].children.push(msg._id); 
    else
        channel.top_lvl_messages.push(msg._id);

    // don't put in the queue if:
    //   - Message authos is current user
    //   - We're in path mode
    if(msg.author !== username && chat_type !== 'path'){
        queue.push(msg);
        $('#queue-length').html('('+queue.length+')');
        clearInterval(new_message_flash);
        new_message_flash = setInterval(message_flash, 700);
    }
    if(tree){
        tree.destroy();
    }
    // add the message to the tree_data and display
    tree_data.nodes.push(new Node(msg._id, msg.content.substr(0,5)+'...', msg.content));
    var msg_parent = msg.msg_parent ? msg.msg_parent : '0';
    tree_data.edges.push(new Edge(msg_parent,msg._id));
    if(chat_type === 'graph' && msg.other_parents)
        for(i = msg.other_parents.length-1; i >= 0; i--)
            tree_data.edges.push(new Edge(msg.other_parents[i], msg._id));
    display_tree();

    // If either the current user is the message author, or we're in linear mode,
    //   then display the message right away
    if(msg.author === username || chat_type === 'path')
        set_hard_focus(msg._id);
    else
        add_msg_to_hover_list(msg);

};

var is_visible = function(id){
    return ($('#'+id+'-wrapper').length > 0);
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
    // Note that if the message is not the hard focus and has only 1 child
    // Then that child is guarenteed to be displayed anyways, so we don't
    // bother with a plus
    if ( ((msg._id === hard_focus && msg.children.length > 0) || msg.children.length > 1) && chat_type != 'path') {
        wrapper.append('<div class="plus-minus-button"><i class="fa fa-plus"></i></div>');
    }
    if (
        (messages[msg.msg_parent] && messages[msg.msg_parent].children.length > 1) ||
        (msg.msg_parent === null && channel.top_lvl_messages.length > 1)
    ){
        wrapper.append('<div class="siblings-symbol"><i class="fa fa-sitemap"></i></div>');
    }
    wrapper.append($("<ul>",{class: 'reveal-children',style: "display:none;"}));
    return wrapper;
};

var make_mulitple_parents_div = function(msg){
    var i, p_div, d, date, p;
    var all_parents = [messages[msg.msg_parent]];
    for (i = 0; i < msg.other_parents.length; i++)
        all_parents.push(messages[msg.other_parents[i]]);
    var wrapper = $("<div>", {class: 'multiple-parents'});
    for (i = 0; i < all_parents.length; i++){
        p = all_parents[i];
        d = new Date(p.created_at);
        date = d.getHours()+":"+d.getMinutes()+" "+d.toDateString();
        p_div = $("<div>",{class: 'multiple-parent', 
            id: p._id, 
            author: p.author,
            created_at: date,
            replies: p.children.length,
            user_visible_id: ids[p._id]});  
        p_div.css({
            'background-color':get_colour(p.author), 
            'width': 99/all_parents.length +'%',
        });
        if (i === 0)
            p_div.css({'float': 'left'});
        p_div.append("<p>"+p.content.replace("\n","<br/>")+"</p>");
        wrapper.append(p_div);
    }
    return wrapper;
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

var get_invite_link = function(invite){
    var base = location.protocol + '//' + location.host + '/invite';
    return base + '?i=' + encodeURIComponent(invite);
};

// -------------------------------


// ------- User Login/off ---------

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

// -------------------------------



// ---- Message Queue Stuff ------

var new_message_flash;

var message_flash = function(){
    var envelope = $('a#mail i')[0];
    envelope.className = 
        envelope.className === "fa fa-envelope" ? 
        "fa fa-envelope-o" : "fa fa-envelope";
};


var blink_new_message = function(id) {
    var iterations = 2; // number of blinks
    var callback = function(iter) {
        if (iter > iterations) {
            return;
        }
        $(id).fadeOut('fast', function(){
            $(this).fadeIn('fast', function(){
                callback(iter+1);
            });
        });
    };
    callback(1);
};

var update_queue_display = function(){
    // Nothing to do for path type chat
    if (chat_type === 'path') return;
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
    $('#list-'+msg._id).on('click', function(){set_hard_focus(msg._id);});
};

var next_msg = function(){
    if(queue.length === 0) return;
    set_hard_focus(queue[0]._id);
    
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

// -------------------------------



// ------ Focus Navigation --------

// This function takes an id and sets that message to the hard focal message,
var set_hard_focus = function(id, hnav){
    // if set_hard_focus was called while naviaging history, do not add to history
    // if not, add to history and clear forward history
    if(!hnav){
        bhistory.push(id);
        fhistory = [];
    }

    // If the message view is scrolled all the way to the bottom,
    //  make note of this so that it can be scrolled all the way down
    //  after the new hard focus is set, otherwise the hard focus 
    //  may be off the screen
    var msg_view = document.getElementById('messages-view');
    var scrolled = msg_view.scrollTop === (msg_view.scrollHeight - msg_view.offsetHeight);

    if(id === "0") return;
    var root = messages[id];
    hard_focus = id;
    // show slection on tree
    display_path_to_root(id);
    //change_view_root(id);
    
    //display_siblings(id);
    display_message(id);

    // add listeners if we're not in path mode
    if (chat_type !== 'path') 
        $('.message, .multiple-parent').on('click',function(){
            set_hard_focus($(this).attr('id'));
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
            var make_bind_func = function(this_id) {
                return function(){set_hard_focus(this_id);};
            };
            var make_queue_tester = function(cid) {
                return function(c){return c._id === cid;};
            };
            var children = messages[id].children;
            var listitem;
            var d, date;
            var displayed = get_path_to_root(messages[hard_focus]).map(
                function(m){return m._id;});
            displayed.push(hard_focus);
            for(var i=0,len=children.length; i<len;i++){
                if (displayed.indexOf(children[i]) > -1)
                    // this message is already displayed, do don't display it
                    continue;
                cmsg = messages[children[i]];
                d = new Date(cmsg.created_at);
                date = d.getHours()+":"+d.getMinutes()+" "+d.toDateString();
                listitem_wrapper = $("<li>", {
                    class: "child-message",
                    id: cmsg._id+'-wrapper'
                });
                listitem = $("<div>",{
                    class: "child-message",
                    id: cmsg._id, 
                    author: cmsg.author,
                    created_at: date,
                    replies: cmsg.children.length,
                    user_visible_id: ids[cmsg._id] 
                });
                listitem.css({
                    'background-color': get_colour(cmsg.author)
                });
                listitem.html("<br/>"+cmsg.content+"<br/>");
                listitem_wrapper.append(listitem);
                list.append(listitem_wrapper);
                $('#'+cmsg._id).on('click', make_bind_func(cmsg._id) );
                // if message is new, blink it, then remove from queue
                if (queue.some(make_queue_tester(cmsg._id))) {
                    blink_new_message('#'+cmsg._id);
                    remove_from_queue(cmsg._id);
                }
                // add a plus sign to indicate that there are children
                if (cmsg.children.length > 0) {
                    listitem_wrapper.append('<div id="'+cmsg._id+'-pm" class="plus-minus-symbol"><i class="fa fa-plus"></i></div>');
                $('#'+cmsg._id+'-pm').on('click', make_bind_func(cmsg._id) );
                }
            }
        }
        list.slideToggle('fast');

    });

    // handle click of siblings symbol
    $('.siblings-symbol').on('click',function(){
        var id = $(this).parent().find('.message').attr('id');
        display_parent_and_siblings(id);    
    });

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
    },dropdown_delay);

    // set soft focus arrow
    set_soft_focus(id);

    // check to make sure displayed message is in view
    //var messages_view = document.getElementById("messages-view");
    //messages_view.scrollTop = // messages_view.scrollHeight;
    //        $('#'+id+'-wrapper').position().bottom;
    
    if(chat_type !== 'path' || scrolled){
        $('#messages-view').animate({ scrollTop: msg_view.scrollHeight}, 500);
    }

 
};

// get the id of the current soft focus message wrapper
var get_soft_focus = function(){
    var arrow = $('#selected-arrow');
    var id;
    if (arrow.length === 0 && chat_type === 'graph') {
        // then we grab the multiple parent soft focus
        id = $('.soft-focus-multiple-parent').attr('id');
    } else {
        id = $('#selected-arrow').parent().attr('id');
        id = id?id.substr(0,id.length-8):null; // strip the "-wrapper" 
    }
    return id;
};

// places the soft-focus arrow on the div of message_id 'id'
var set_soft_focus = function (id){
    if (chat_type === 'path')
        // then we have no concept of soft focus
        return;
    // first remove margin from current soft focus
    var cur_soft = get_soft_focus();
    if($('#'+cur_soft).length > 0 && $('#'+cur_soft).attr('class').indexOf('multiple-parent') === -1) {
        $('#'+cur_soft+'-wrapper').css({'margin-left':''});
        $('#'+cur_soft+'-wrapper ul.reveal-children').css({'margin-left':'20px'});
    }

    // delete current arrow/focus
    $('#selected-arrow').remove();
    $('.soft-focus-multiple-parent').removeClass('soft-focus-multiple-parent');

    // If not a multiple-parent, add the arrow back
    if($('#'+id).attr('class').indexOf('multiple-parent') === -1 || chat_type !== 'graph'){ 
        $('#'+id+'-wrapper').prepend(
                '<div id="selected-arrow">'+
                    '<i class="fa fa-chevron-circle-right"></i>'+
                '</div>');
        // fix indenting
        var arrow_width = $('#selected-arrow').width();
        var new_margin = ( (id===hard_focus) ? 20 : 0) -$('#selected-arrow').width();
        $('#'+id+'-wrapper').css({
            'margin-left':(((id===hard_focus) ? 20 : 0) - arrow_width) +'px'
        });
        $('#'+id+'-wrapper ul.reveal-children').css({
            'margin-left': 20+arrow_width+'px'});
    } else {
        // otherwise, we just add the soft focus class
        $('#'+id).addClass('soft-focus-multiple-parent');
    }
};

// --------------------------------


// -------- Navigation ------------

var move_arrow = function(dir){
    var move;
    switch(dir){
        case 'up':
            move = -1;
            break;
        case 'down':
            move = 1;
            break;
        default:
            return;
    }
    // get all currently visible messages in their document order
    var current_display = $('.message, .multiple-parent, div.child-message:visible');
    var soft_focus = get_soft_focus();
    
    var cur_order = $.map(current_display, function(m){return m.id;});
    var pos = cur_order.indexOf(soft_focus);
    // if we're at the top or bottom, do nothing
    if ((move === -1 && pos === 0) || (move === 1 && pos === cur_order.length-1)) {
        return;
    }

    // otherwise move
    set_soft_focus(cur_order[pos+move]);
};




// moves the soft-focus arrow visually up on screen
var arrow_up = function(){
    move_arrow('up');

};

// moves the soft-focus arrow visually down on screen
var arrow_down = function(){
    move_arrow('down');
};

var to_left_sibling = function(){
    var id = get_soft_focus();
    var siblings = messages[id].msg_parent ? 
        messages[messages[id].msg_parent].children : 
        channel.top_lvl_messages;
    if(siblings.indexOf(id) <= 0)
        return;
    var left = siblings[siblings.indexOf(id)-1];
    if(is_visible(left))
            set_soft_focus(left);
    else
        set_hard_focus(left);
};

var to_right_sibling = function(){
    var id = get_soft_focus();
    var siblings = messages[id].msg_parent ? 
        messages[messages[id].msg_parent].children : 
        channel.top_lvl_messages;
    if(siblings.indexOf(id) >= siblings.length-1 || siblings.indexOf(id) === -1)
        return;

    var right = siblings[siblings.indexOf(id)+1];
    if(is_visible(right))
            set_soft_focus(right);
    else
        set_hard_focus(right);
};

// make soft focus the hard focal node
var descend_from_soft_focus = function(){
    var soft_focus = get_soft_focus();
    // if the soft focus isn't the hard focus, the change that
    if(hard_focus !== soft_focus){
        set_hard_focus(soft_focus);
    }
    // set soft focus to last child
    var children = messages[soft_focus].children;
    if(children.length > 0)
        // wait for dropdown then set selected arrow to last child
        setTimeout(function(){
            set_soft_focus(children[children.length-1]);
        },dropdown_delay+10);
};

// go to parent of soft focus
var ascend_from_soft_focus = function(){
    msg_parent = messages[get_soft_focus()].msg_parent;
    if(msg_parent !== null)
        set_hard_focus(msg_parent);
};


var display_path_to_root = function(id){
    if (id === "0")
        go_to_root();

    var msg_view = $('#messages-view');
    var msg_div;

    msg_view.empty();

    if (chat_type === 'graph' && messages[id].other_parents.length > 0) {
        // in this case we don't want to display a path to root, 
        // just show the multiple parents
        msg_view.append("<h4> Multiple Parents</h4>");
        msg_view.append(make_mulitple_parents_div(messages[id]));
    } else {
        var path = get_path_to_root(messages[id]);
        // if not path mode, only display the previous ten messages
        if (chat_type !== 'path')
            if(path.length>10) path = path.slice(path.length-10,path.length);

        if (chat_type === 'graph') {
            // only display until we have a message with multiple parents
            var multiple_parents = false;
            // index of the first message to have multiple parents
            for(var first_mp = path.length-1; first_mp>=0; first_mp--)
                if (path[first_mp].other_parents.length > 0) {
                    multiple_parents = true;
                    path = path.slice(first_mp, path.length);
                    break;
                }
            if(multiple_parents) {
                // If there were multiple parents, display them
                var title = $("<h4>");
                title.css('opacity', String(1/(path.length+1)));
                title.append("Multiple Parents");
                var parents_div = make_mulitple_parents_div(path[0]);
                parents_div.css('opacity', String(1/(path.length+1)));
                msg_view.append(title);
                msg_view.append(parents_div);
            }
        }
        for(var i=0, len = path.length; i<len; i++){
            msg_div = make_msg_div(path[i]);
            //msg_div.css('opacity', i === len-1 ? '1':'0.'+(i+1+(10-len)));
            // If chat type is path, then don't adjust the opacity
            if (chat_type !== 'path')
                msg_div.css('opacity', String((i+1)/(len+1)));
            msg_view.append(msg_div);
        }
    }
};

// Essentially just set the parent to the hard focus
var display_parent_and_siblings = function(id){
    // if it's a top level node, go to root
    var parent = messages[id].msg_parent;
    if(id === "0" || parent === null){
        go_to_root();
    } else{
        set_hard_focus(parent);
    }
};


var display_message = function(id){
    $('#messages-view').append(make_msg_div(messages[id]));
    // no indent in path mode
    if (chat_type !== 'path')
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
            set_hard_focus($(this).attr('id'));
        });
    }
};




var go_to_root = function(){ // change the chat to the root of the channel
    //hard_focus = null;
    var msg_view = $('#messages-view');
    msg_view.empty();
    var msg;
    for(var i = 0, len = channel.top_lvl_messages.length; i<len; i++){
        msg_view.append(make_msg_div(messages[channel.top_lvl_messages[i]]));
    }
    $('.message').on('click',function(){
        set_hard_focus($(this).attr('id'));
    });
}; 

/* No longer used
 * uncomment for seen/queue back/forward behaviour
 *
var back = function(){ // when back arrow is clicked
    // This version of back goes to the previous node in the tree:
    // if at root, logout and go to channels page
//    if(!hard_focus){
//        // logout();
//        $('form#back-form input').val(username);
//        $('#back-form').submit();
//    } else {
//        if(messages[hard_focus].msg_parent === null)
//            go_to_root();
//        else 
//            set_hard_focus(messages[hard_focus].msg_parent);
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
            set_hard_focus(seen[seen.length-1]._id);
        }
        update_queue_display();
    }

};
*/

var back = function(){
    if(bhistory.length > 0){
       var last = bhistory.pop();
       fhistory.push(last);
       if(hard_focus === last){
        last = bhistory.pop();
        fhistory.push(last);
       }
       set_hard_focus(last,true);
    }
};

var forward = function(){
    if(fhistory.length > 0){
       var next = fhistory.pop();
       bhistory.push(next);
       if(hard_focus === next){
        next = fhistory.pop();
        bhistory.push(next);
       }
       set_hard_focus(next,true); 
    }
};


// ----------------------------------------

// ---------- Graph Mode Functions --------

// takes a user visible ID and adds a parent to the currently 
// being composed message
var add_parent = function(id){
    if (chat_type !== 'graph') return;
    msg_id = dbid_to_userid[id];
    if(!msg_id){
        alert("No message with id "+id+" exists");
        return;
    }
    if(other_parents.indexOf(msg_id) === -1) {
        other_parents.push(msg_id);
        $('#other-parents').append(make_op_li(msg_id));
        // Add this node to the selection in the tree view
        var selection = tree.getSelection();
        selection.nodes.push(msg_id);
        tree.selectNodes(selection.nodes);
    }
};

var make_op_li = function(msg_id){
    msg = messages[msg_id];
    id = ids[msg_id];
    return '<li id="opli-' + msg_id +
                '"> <b> Message ' + id +
                ':</b>  ' + msg.content +
                '<span id="op-' + msg_id +
                '" class="op-x" >&#215;</span></li>';
};


// takes a proper message id, not a user visible one
var remove_parent = function(id){
    $('#opli-'+id).remove();
    var selection = tree.getSelection();
    var i = other_parents.indexOf(id);
    if (i > -1)
        other_parents.splice(i, 1);
    i = selection.nodes.indexOf(id);
    if (i > -1)
        selection.nodes.splice(i, 1);
    tree.selectNodes(selection.nodes);
};

var reset_other_parents = function (){
    $('#other-parents').html('');
    other_parents = [];
};

// ----------------------------------------



// ------- Tree View ----------

var tree_data, tree;

function Node(id, label, title){
    this.id    = id;
    this.label = label;
    this.title = title;
}

function Edge(from, to){
    this.from = from;
    this.to   = to;
}

var build_tree = function(){
    var msg;
    // supply an 'undefined' title so that no tooltip comes up
    var root = new Node('0',channel.name, undefined); 
    var msg_array = Object.keys(messages);
    tree_data = {
    nodes: [],
    edges: []
    };
    tree_data.nodes.push(root);
    for(var i=0, len=msg_array.length; i<len; i++){
        msg = messages[msg_array[i]]; 
        tree_data.nodes.push(new Node(msg._id, msg.content.substr(0,5)+'...', msg.content));
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
    $('#view').on('click',function(){set_hard_focus(msg_id);});
};

var display_tree = function(){
    var container = document.getElementById('tree');
    var options = {
        edges : {
            arrows : {
                to: {enabled: true, scaleFactor:1}
            }
        },
        layout: {
            hierarchical: {
                direction: 'UD',
                sortMethod: 'directed'
            } 
        },
        interaction: {
            // only multiselect for a graph
            multiselect: (chat_type === 'graph')
        },
    };
    tree = new vis.Network(container, tree_data, options);
    tree.on('doubleClick', function(e){
        if (e.nodes.length > 0)
            set_hard_focus(e.nodes[0]);
    });
    tree.on('selectNode', function(e){
        if (chat_type === 'graph') {
            for (var i = 0; i < e.nodes.length; i++)
                if(other_parents.indexOf(e.nodes[i]) === -1) {
                    msg_id = e.nodes[i];
                    other_parents.push(msg_id);
                    $('#other-parents').append(make_op_li(msg_id));
                }
        }
    });
    tree.on('deselectNode', function(e){
        // if nothin new is selected, then don't deselect
        if(e.nodes.length === 0)
            tree.setSelection(e.previousSelection);
        else if (chat_type === 'graph') {
            for (var i = 0; i < e.previousSelection.nodes.length; i++){
                if (e.nodes.indexOf(e.previousSelection.nodes[i]) === -1){
                    var id = e.previousSelection.nodes[i];
                    $('#opli-'+id).remove();
                    var index = other_parents.indexOf(id);
                    if (index > -1)
                        other_parents.splice(index, 1);
                }
            }
        }
    });
};

var toggle_tree_view = function(){
    var toggle_tree = $('#toggle-tree');
    if(toggle_tree.html().indexOf("Show") > -1){
        $('#chat-view').show();
        toggle_tree.html("Hide Tree View");
        $('#users-view').css({'top':'','bottom':'0'});
    } else {
        $('#chat-view').hide();
        toggle_tree.html("Show Tree View");
        $('#users-view').css({'top':'0','bottom':''});
    }
};

// -------------------------------



var handle_keydown = function(e){
    var code = e.keyCode || e.which;
    // don't do anything if the user is typing
    if($('#message').val().trim()){
        if(code === 13) send_message();
        return;
    }
    keys[code] = true;
    if(Object.keys(keys).length > 1) {
        // check shift+right arrow
        // shift = 16, r arrow = 39
       if (Object.keys(keys).length === 2 && keys[16] && keys[39]) {
           // on shift arrow, make soft focus the hard focus
           set_hard_focus(get_soft_focus()); 
           return;
        }
    }
    switch(code){
        case 13: // enter
            next_msg();
            //descend_from_soft_focus();
            $('#message').val('');
            e.preventDefault();
            break;
        case 37: // left
            //ascend_from_soft_focus();
            to_left_sibling();
            break;
        case 38: // up
            arrow_up();
            //ascend_from_soft_focus();
            break;
        case 39: // right
            /* This is for the queue/seen behaviour
            next_msg();
            $('#message').val('');
            e.preventDefault();
            */
            //descend_from_soft_focus();
            to_right_sibling();
            break;
        case 40: // down
            arrow_down();
            //descend_from_soft_focus();
            break;
        default:
            break;
    }
};



$(document).ready(function(){
    var q = "username="+username+"&channel="+channel._id;
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
        set_hard_focus($(this).attr('id'));
    });

    // make the channel name go to the root if we're not in
    if(chat_type !== 'path')
        $('#channel-name').on('click',function(){hard_focus=null;go_to_root();});

    $('#backward').on('click',back);
    $('#forward').on('click',forward);

    $('a#mail').on('click',next_msg);
    
    $('textarea#message').on('keydown',handle_keydown);
    // clear key in keys dict on key up
    $('textarea#message').on('keyup', function(e){
        var code = e.keyCode || e.which;
        delete keys[code];
    });



    assign_colour();

    update_online();


    $('#invite-link').on('click',function (e) {
        // select the whole link on a click
        var link = document.getElementById('invite-link');
        var range = document.createRange();
        range.selectNodeContents(link);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        // don't run the body click listener (will deselect...)
        e.stopPropagation();
    });

    $('body').on('click',function(){
        // unless the user has clicked to add a parent or invite someone, then
        // automatically refocus to the main message
        if(!$('#extra-parent').is(':focus') && 
            !$('#invite-username').is(':focus') &&
            !$('#invite-password').is(':focus'))
            $('#message').focus();
    });
    $('#message').focus();

    build_tree();
    display_tree();

    if (chat_type === 'path'){
        // Then hide the tree view for good
        $('#chat-view').hide();
        $('#users-view').css({'top':'0','bottom':''});

    } else {
        // default to closed tree view
        //toggle_tree_view();
        //$('#toggle-tree').on('click',toggle_tree_view);
    }

    most_recent = queue[queue.length-1];
    // get id, if not undefined
    if (most_recent) most_recent = most_recent._id;

    if (chat_type === 'path') {
        // In this case, just set the most recent message as the hard focus,
        //  which will display every other message along the way
        if(most_recent)
            set_hard_focus(most_recent);
    } else {
        // otherwise, if the queue is non-empty, set up the unseen message list
        if(queue.length > 0){
            new_message_flash = setInterval(message_flash, 700);
            for(var i=queue.length-1;i>=0;i--){
                add_msg_to_hover_list(queue[i]);
            }
        }
    
        // and get things started with the first message
        next_msg();
    }

    // resize tabs
    var vwidth = $('#view-column').width();
    var tabs = $('.tab-title').length;
    $('.tab-title').css({'width': (vwidth / tabs) + 'px'});

    // handle when the "other parents" form is submitted
    if (chat_type === 'graph') {
        $('#other-parent').submit(function(event){
            event.preventDefault();
            var msg_id = parseInt($('#extra-parent').val());
            if (isNaN(msg_id))
                return;
            $('#extra-parent').val('');
            add_parent(msg_id);
        });
    }


    

    $('#invite-form').submit(function(e){
        e.preventDefault();
        var username = $('#invite-username').val();
        var password = $('#invite-password').val();
        $('#gen-link').prop('disabled', true);
        $('#invite-link').html("Loading...");
        var data = {
              'channel': channel._id,
              'username': username,
              'password': password
        };
        $.ajax({
            type : "POST",
            url  : '/makeinvite',
            data : JSON.stringify(data),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
        }).success(function(data){
            $('#invite-link').html(get_invite_link(data.invite));
        }).always(function(){
            $('#gen-link').prop('disabled', false);
            });
    });

    $(document).on('closed.fndtn.reveal', '[data-reveal]', function () {
        $('#invite-username').val('');
        $('#invite-password').val('');
        $('#invite-link').html('');
    });

    $(document).on('click', '.op-x', function(e) {
        var msg_id = $(this).attr('id').substr(3);
        remove_parent(msg_id);
    });
        




    // show help dialog
    $('#help-modal').foundation('reveal', 'open');



});

