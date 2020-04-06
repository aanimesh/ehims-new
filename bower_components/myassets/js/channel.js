var TIME_X = 5;     // alert a warning if the experiment channel keeps idle for TIME_X min.
var TIME_Y = 2;     // the experiment stops if the experiment channel keeps idle for another TIME_Y minutes after the alert.
var DURATION = 60;  // maximum duration for an experiment (minutes)

var hard_focus = null;
var most_recent = null;
var socket;
var keys = {};
var dropdown_delay = 250; // ms to children dropdown shows
var chat_type = channel.chat_type;
var other_parents = [];
var online_count = 0;
var wait_signal = 0;
var modify_signal = 0;
var change_parent = {};
var latest_child = [];
var color_table = [];
var WAITING_MINUTES = 10;
var last_msg_time = new Date();
var flag1 = 0;
var flag2 = 0;
var START_TIME;

var PLUS_CLICKABLE = false;


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

    // remove actual parent and root from parents
    if (parents.indexOf(msg_parent) > -1)
        parents.splice(parents.indexOf(msg_parent), 1);

    if (parents.indexOf("0") > -1)
        parents.splice(parents.indexOf("0"), 1);
    var urgency = $("#urgencybox").is(':checked');

    var message = {
        'author'    : username,
        'channel'   : channel._id,
        'msg_parent': msg_parent,
        'other_parents': parents,
        'children'  : [], 
        'likes'     : [],
        'bookmarked': [],
        'original_version':[],
        'urgency'   : true,
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
        $("#urgencybox").prop('checked', false);;
    });
};

var waiting_time = setInterval(function(){
    var now = new Date();
    var time_delta = now - last_msg_time;
    if(channel.type == 'in progress'){
        if(now - START_TIME > DURATION*1000*60){
            waiting_page("Time's Up. <br> Thank you for your cooperation, please click the button to complete a post survey.");
            $("#waiting_page").append("<a id='logout-yes' onclick='document.getElementById("+'"name-form"'+").submit()' style='position:relative;display:inline-block;margin-left:42%;float:left;margin-top:3%'>\
                                        <button>Post Survey</button></a>");
            flag1 = 1;
            flag2 = 1;
            $.ajax({
                url:"/force_stop",
                type:"POST",
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                data : JSON.stringify({'channel':channel._id}),
            }).success(function(data){
                channel.type = 'result';
            });
        }
        if(time_delta > TIME_X*1000*60 && (TIME_Y + TIME_X)*1000*60 > time_delta && flag1 == 0){
            flag1 = 1;
            alert("The channel has been idle for "+TIME_X+" minutes. It will automatically stop if it keep inactive for "+TIME_Y+" more minutes.");
        }
        else if(time_delta > (TIME_Y + TIME_X)*1000*60 && flag2 == 0){
            flag2 = 1;
            waiting_page("This experiment stops for being idle too long.<br> Thank you for your cooperation, please click the button to complete a post survey.");
            $("#waiting_page").append("<a id='logout-yes' onclick='document.getElementById("+'"name-form"'+").submit()' style='position:relative;display:inline-block;margin-left:42%;float:left;margin-top:3%'>\
                                        <button>Post Survey</button></a>");
            $.ajax({
                url:"/force_stop",
                type:"POST",
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                data : JSON.stringify({'channel':channel._id}),
            }).success(function(data){
                channel.type = 'result';
            });
        }
    }
}, 1000*60);


var receive_msg = function(msg, top_lvl_messages){
    last_msg_time = new Date();
    flag1 = 0;
    flag2 = 0;
    var urgency = msg.urgency;

    var i;
    messages[msg._id] = msg;
    ids[msg._id] = cur_id;
    dbid_to_userid[cur_id] = msg._id;
    cur_id++;
    most_recent = msg._id;
    channel.top_lvl_messages = top_lvl_messages

    if(msg.msg_parent)
        messages[msg.msg_parent].children.push(msg._id);

    if(chat_type === 'graph' && msg.other_parents)
        for(i = msg.other_parents.length-1; i >= 0; i--)
           messages[msg.other_parents[i]].children.push(msg._id); 

    // don't put in the queue if:
    //   - Message authos is current user
    //   - We're in path mode
    if(msg.author !== username && chat_type !== 'path'){
        if (urgency == true)
            queue.unshift(msg);
        else
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
    var class_str="message view",info_div; 
    //class_str += msg.author===username?"message-user":"message-other";
    var wrapper = $("<div>",{class: 'message-wrapper', id: msg._id+'-wrapper'});
    var d = new Date(msg.created_at);
    var date = d.getHours()+":"+d.getMinutes()+" "+d.toDateString();
    var author = msg.author;
    if(msg.original_version.length > 0)
        author = author + ' (edited)';
    var msg_div = $("<div>",{class: class_str, 
        id: msg._id, 
        author: author,
        created_at: date,
        replies: msg.children.length,
        user_visible_id: ids[msg._id]});  
    msg_div.append("<div class='row'><div class='columns medium-12 msg_content'><p>"+
        msg.content.replace("\n","<br/>")+"</p></div>");
    msg_div.css({'background-color':get_colour(msg.author)});

    var bookmarked = new Boolean(false);
    msg.bookmarked.forEach(function(tmsg){
        if (tmsg == username)
            bookmarked = true; 
    });
    var msg_bookmarked = $("<div>", {class: 'bookmarked', id: 'bookmarked-'+msg._id, user: msg.author});
    if(bookmarked === true)
        msg_bookmarked.append('<i class="fa fa-bookmark fa-lg"></i>');
    else
        msg_bookmarked.append('<i class="fa fa-bookmark-o fa-lg"></i>');
    msg_div.append(msg_bookmarked);

    var liked = false;
    msg.likes.forEach(function(user){
        if(user === username)
            liked = true;
    });
    var msg_likes = $("<div>", {class: 'columns small-2 msg_likes', id: 'msg_likes-'+msg._id, msg_id: msg._id, user: msg.author});
    if(liked)
        msg_likes.append('<i class="fa fa-thumbs-up fa-lg"></i><p id="likes-p-'+msg._id+'">  '+msg.likes.length+' likes</div>');
    else
        msg_likes.append('<i class="fa fa-thumbs-o-up fa-lg"></i><p id="likes-p-'+msg._id+'">  '+msg.likes.length+' likes</p></div>');
    msg_div.append(msg_likes);

    if(msg.original_version.length > 0){
        var edit_history = 'Edit History:';
        for(var x = 0; x < msg.original_version.length; x ++){
            var cnt = x+1;
            if(msg.original_version[x].includes("*orginal parents*:")){
                var op = msg.original_version[x].replace("*orginal parents*: ", '');
                op = op.split(',');
                var user_visible_ids = [];
                op.forEach(id => {
                    if(ids[id] != null || ids[id] != undefined)
                        user_visible_ids.push(ids[id])});
                edit_history += '<br>version '+cnt.toString()+': *[Hierarchical Changes] PID: '+user_visible_ids.join(', ');
            } else 
                edit_history += '<br>version '+cnt.toString()+': '+msg.original_version[x];
        }
        msg_div.append('<span class="edit_history">'+edit_history+'</span>');
    }
    wrapper.append(msg_div);
    // Note that if the message is not the hard focus and has only 1 child
    // Then that child is guarenteed to be displayed anyways, so we don't
    // bother with a plus
    if ( ((msg._id === hard_focus && msg.children.length > 0) || msg.children.length > 1) && chat_type != 'path') {
        wrapper.append('<div class="plus-minus-button"><i class="fa fa-plus"></i></div>');
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
        p = all_parents[i]
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

var stop_experiment = function(stop_signal){
    if(stop_signal == 1)
        channel_gate();
};

// before experiment starts
var channel_gate = function(pos, msg){
    if(channel.type == 'experiment'){
        var time = new Date();
        var start_time = new Date(channel.started_at);
        var time_delta = start_time.getTime() - time.getTime() + 1000*60*60;
        var user_delta = parseInt(channel.users_number) - pos;
        if(STARTTIME == true){
            if(time_delta > (1000*60*2)){
                if(user_delta > 0)
                    waiting_page("This experiment will start at <br>"+start_time.toLocaleString("en-US", { timeZone: 'America/Montreal' })+"<br><br> There are "+user_delta+" seats remaining...");
                else
                    waiting_page("This experiment will start at <br>"+start_time.toLocaleString("en-US", { timeZone: 'America/Montreal' }));
            }
            else if(time_delta < (-1)*(1000*60*WAITING_MINUTES))
                waiting_page("Sorry that this channel is expired.<br><br> Please go back to the following link to choose another channel :) <br> <a href='"+ socket_url+"homepage'>"+socket_url+"homepage</a>");
            else{
                if(user_delta > 0)
                    waiting_page("There are still "+user_delta+" seats remaining...");
                else
                    experiment_started();
            }
        }
        else{
            if(user_delta > 0)
                waiting_page("There are still "+user_delta+" seats remaining...");
            else
                experiment_started();
        }
    }
    else if(channel.type == 'in progress'){
        waiting_page("This experiment finishes because some participants log off.<br> Thank you for your cooperation, please click the button to complete a post survey.");
        $("#waiting_page").append("<a id='logout-yes' onclick='document.getElementById("+'"name-form"'+").submit()' style='position:relative;display:inline-block;margin-left:42%;float:left;margin-top:3%'>\
                                    <button>Post Survey</button></a>");
    }
};

var waiting_page = function(msg){
    $('body').children().hide();
    $('#waiting_page').show();
    $('#waiting_page > h3').html(msg);
    $('#navbar').show();
};

var experiment_started = function(){
    $('body').children().show();
    $('#waiting_page').hide();
    $.ajax({
        url:"/start",
        type:"POST",
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        data : JSON.stringify({'channel':channel._id}),
    }).success(function(data){
        channel.type = "in progress";
        $("#logout-yes").attr('href', '#');
        $("#logout-yes").attr('onclick', "document.getElementById('name-form').submit()");
        last_msg_time = new Date();
        START_TIME = new Date();
    });
};

var user_log_on = function(uname, participants_queue){
    participants = participants_queue;
    update_online();
};

var user_log_off = function(uname, participants_queue){
    participants = participants_queue;
    update_online();
};

var update_online = function(){
    $('#online-users-list').html('');
    online_count = 0;
    participants.forEach(function(dict){
        var color = get_colour(dict.name, dict.color);
        if(dict.online == true){
            online_count += 1;
            $('#online-users-list').prepend('<li style="color:'+
                color+';" a(href="#" data-reveal-id="user-modal")>'+dict.name+' (online)</li>');
        }
        else{
            $('#online-users-list').append('<li style="color:'+
                color+';" a(href="#" data-reveal-id="user-modal")>'+dict.name+'</li>');
        }
    });
    $('#num-online').html(
            '('+online_count+'/'+participants.length+')'
            );
    if(channel.type == "experiment")
        channel_gate(online_count);
};

var get_colour = function(author, color){
    if(color_table[author] == undefined || color_table[author] == null){
        color_table[author] = colours[(color+1) % colours.length];
        return colours[(color+1) % colours.length];
    }
    else
        return color_table[author];
};

var assign_color = function(){
    participants.forEach(function(dict){
        color_table[dict.name] = colours[(dict.color+1) % colours.length];
    });
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
    // identify the message as new
    $(id).addClass('new-blink-message');

    var sleep = 2000; // 2 seconds between blinks
    var callback = function(iter) {
        // stop if the message is no longer new
        if (!$(id).hasClass('new-blink-message')) {
            return;
        }
        $(id).fadeOut('fast', function(){
            $(this).fadeIn('fast', function(){
            $(this).fadeOut('fast', function(){
            $(this).fadeIn('fast', function(){
                setTimeout(function(){callback(iter+1);}, sleep);
            });});});
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
    if(msg.urgency == true)
        $('#new-msg-list').prepend('<li id="list-'+
            msg._id +'">'+
            msg.author + ': ' +
            msg.content.substring(0, 
                (25-msg.author.length)>0? 25-msg.author.length : 0) +
            '</li>');
    else 
        $('#new-msg-list').append('<li id="list-'+
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



// -------------------------------


// ------ Focus Navigation --------

// This function takes an id and sets that message to the hard focal message,
var set_hard_focus = function(id, hnav, signal){
    // if set_hard_focus was called while naviaging history, do not add to history
    // if not, add to history and clear forward history

    if(hard_focus == id){
        if(modify_signal == 1){
            if (messages[id].author.replace(' (edited)', '') == username){
                $('.message-selected .msg_content p').attr('contenteditable', 'true');
                $('.message-selected .msg_content p').focus();
            }
        }
        else
            return;
    }
    
    remove_from_queue(id);
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


    var show_children = function(id) {
        var list = $('#'+id).parent().closest('div').find('.reveal-children');
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
                var author = cmsg.author;
                if (cmsg.original_version.length > 0)
                    author = author + ' (edited)';
                listitem = $("<div>",{
                    class: "child-message",
                    id: cmsg._id, 
                    author: author,
                    created_at: date,
                    replies: cmsg.children.length,
                    user_visible_id: ids[cmsg._id] 
                });
                listitem.css({
                    'background-color': get_colour(cmsg.author)
                });
                listitem.html("<p>"+cmsg.content+"</p>");
                if(cmsg.other_parents.length > 0)
                    listitem_wrapper.append(
                        '<div class="mp-symbol"><i class="fa fa-clone"></i></div>'
                    );

                if(cmsg.original_version.length > 0){
                    var edit_history = 'Edit History:';
                    for(var x = 0; x < cmsg.original_version.length; x ++){
                        var cnt = x+1;
                        if(cmsg.original_version[x].includes("*orginal parents*: ")){
                            var op = cmsg.original_version[x].replace("*orginal parents*: ", '');
                            op = op.split(',');
                            var user_visible_ids = [];
                            op.forEach(id => {
                                if(ids[id] != null || ids[id] != undefined)
                                    user_visible_ids.push(ids[id])});
                            edit_history += '<br>version '+cnt.toString()+': *[Hierarchical Changes] PID: '+user_visible_ids.join(', ');
                        } else 
                            edit_history += '<br>version '+cnt.toString()+': '+cmsg.original_version[x];
                    }
                    listitem.append('<span class="edit_history">'+edit_history+'</span>');
                }

                var bookmarked = new Boolean(false);
                cmsg.bookmarked.forEach(function(tmsg){
                    if (tmsg == username)
                        bookmarked = true; 
                });
                var msg_bookmarked = $("<div>", {class: 'bookmarked', id: 'bookmarked-'+cmsg._id, user: cmsg.author});
                if(bookmarked === true)
                    msg_bookmarked.append('<i class="fa fa-bookmark fa-lg"></i>');
                else
                    msg_bookmarked.append('<i class="fa fa-bookmark-o fa-lg"></i>');
                listitem.append(msg_bookmarked);

                var liked = false;
                cmsg.likes.forEach(function(user){
                    if(user === username)
                        liked = true;
                });
                var msg_likes = $("<div>", {class: 'columns small-2 msg_likes', id: 'msg_likes-'+cmsg._id, msg_id: cmsg._id, user: cmsg.author,
                                    style:'left:-5%; top: 0.8222rem; width: auto'});
                if(liked)
                    msg_likes.append('<i class="fa fa-thumbs-up fa-lg"></i><p id="likes-p-'+cmsg._id+'">  '+cmsg.likes.length+' likes</div>');
                else
                    msg_likes.append('<i class="fa fa-thumbs-o-up fa-lg"></i><p id="likes-p-'+cmsg._id+'">  '+cmsg.likes.length+' likes</p></div>');
                listitem.append(msg_likes);
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
                if(PLUS_CLICKABLE)
                    $('#'+cmsg._id+'-pm').on('click', make_bind_func(cmsg._id) );
                }
            }
        }
        list.slideToggle('fast');
    };


    // handle children reveal
    if(PLUS_CLICKABLE) {
        $('.plus-minus-button').on('click',function(){
            var id = $(this).parent().find('.message').attr('id');
            // toggle symbol
            $(this).find('i').attr('class',
                $(this).find('i').attr('class').indexOf('plus')>-1 ? 
                'fa fa-minus':'fa fa-plus');
            show_children(id);
        });
    } else { 
        // still expand the children even if "+" isn't clickable
        setTimeout(function(){show_children(id);}, dropdown_delay);
    }
    // handle click of siblings symbol
    // Uncomment for siblings symbol
    /*
    $('.siblings-symbol').on('click',function(){
        var id = $(this).parent().find('.message').attr('id');
        display_parent_and_siblings(id);    
    });
    */

    // remove self from queue
    for(var i=0, len=queue.length; i<len; i++){
        if(queue[i]._id === id){
            seen.push(queue.splice(i,1)[0]);
            blink_new_message('#'+id);
            break;
        }
    }

    if(chat_type !== 'path')
        tree.selectNodes([id]);
    update_queue_display();

    $('#message').trigger("focus");

    //automatically expand children
    if(PLUS_CLICKABLE)
        setTimeout(function() {
            $('#'+id+'-wrapper .plus-minus-button').trigger("click");
        },dropdown_delay);

    // set soft focus arrow
    set_soft_focus(id);

    // check to make sure displayed message is in view
    //var messages_view = document.getElementById("messages-view");
    //messages_view.scrollTop = // messages_view.scrollHeight;
    //        $('#'+id+'-wrapper').position().bottom;\
    $('#messages-view').animate({ scrollTop: msg_view.scrollHeight}, 500);

    if(modify_signal == 1){
        if (messages[id].author.replace(' (edited)', '') == username){
            $('.message-selected .msg_content p').attr('contenteditable', 'true');
            $('.message-selected .msg_content p').focus();
        }
    };
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
        var mdiv = make_mulitple_parents_div(messages[id]);
        mdiv.css('opacity', String(0.5));
        msg_view.append(mdiv);
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
    if (chat_type !== 'path'){
        document.getElementById(id+'-wrapper').className += ' message-selected';
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
            set_hard_focus($(this).attr('id'));
        });
    }
};


var go_to_root = function(){ // change the chat to the root of the channel
    hard_focus = null;
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

var back = function(){
    bhistory = bhistory.filter(value => value !== null || undefined)
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
    fhistory = fhistory.filter(value => value !== null || undefined)
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

// ---------------------------------------

// ---------- Popup window ---------------
var display_popup_msg = function(msg_ids, modal){
    if(msg_ids.length == 0 && modal == 'search-modal'){
        $('#'+modal+' > #modal-msg').empty();
        $('#'+modal+' > #modal-msg').append('<p>Sorry, no results found.</p>');
        return;
    }
    else if(msg_ids.length == 0){
        $('#'+modal+' > #modal-msg').empty();
        return;
    }
    $('#'+modal).css('height', '85%');
    $('#'+modal+' > #modal-msg').empty();
    for(var i = 0; i < msg_ids.length; i ++){
        //alert(messages[msg_ids[i]].likes);
        var wrapper = make_msg_div(messages[msg_ids[i]]);
        wrapper.css('width', '90%');
        $('#'+modal+' > #modal-msg').append(wrapper);
    };
};

var receive_likes = function(msg){
    var likes_div = $("#msg_likes-"+msg.msg_id+">p");
    var cancel = false;
    messages[msg.msg_id].likes.forEach(function(user){
        if(user == msg.user)
            cancel = true;
    });

    if(cancel == true)
        messages[msg.msg_id].likes = messages[msg.msg_id].likes.filter(name => name != msg.user);
    else
        messages[msg.msg_id].likes.push(msg.user);
    likes_div.html(msg.likes.length+' likes');
};

var get_ranking = function(){
    var items = Object.keys(messages).map(key => [key, messages[key].likes.length]);
    items.sort((key, length) => length[1] - key[1]);
    var data = [];
    items.forEach(item => data.push(item[0]));
    return data;
};

var get_msg_by_author = function(name){
    var data = [];
    Object.keys(messages).forEach(function(key){
        if(messages[key].author == name)
            data.unshift(key);
    });
    return data;
};

var get_bookmark_message = function(name){
    var data = [];
    Object.keys(messages).forEach(function(key){
        var seen = 0;
        messages[key].bookmarked.forEach(function(tuser){
            if(tuser == name)
                seen = 1;
        });
        if(seen == 1)
            data.unshift(key);
    });
    return data;
};

var search_message = function(field, text){
    var result = [];
    switch(field){
        case "ID":
            Object.keys(ids).forEach(key => {
                if(ids[key] == text)
                    result.push(key);
            });
            break;
        case "content":
            Object.keys(messages).forEach(key => {
                msg = messages[key];
                if(msg.content.includes(text))
                    result.push(msg._id);
            });
            break;
        case "author":
            result = get_msg_by_author(text);
            break;
        default:
            break;
    };
    return result;
};

var get_sequential_message = function(){
    var data = [];
    var items = Object.keys(messages).map(key => [key, messages[key].created_at]);
    items.sort((key, created_at) => created_at[1] - key[1]);
    items.forEach(item => data.push(item[0]));
    return data.reverse();
};

var back_home = function(){
    var input = document.getElementById("back-home");
    var input1 = document.getElementById("name-form-input");
    var input2 = document.getElementById("name-form-input1");
    if(input)
        input.setAttribute('value', username);
    if(input1)
        input1.setAttribute('value', username);
    if(input2)
        input2.setAttribute('value', channel._id);
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

var trim_name = function(n) {
    var l = {
        'path': ' (Sequential)'.length,
        'tree': ' (Tree)'.length, 
        'graph': ' (Graph)'.length
        }[chat_type];
    return n.substr(0, n.length - l);
};

var build_tree = function(){
    var msg;
    // supply an 'undefined' title so that no tooltip comes up
    var root = new Node('0',trim_name(channel.name), undefined); 
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
    if(chat_type === 'path'){
        return;
    }
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

    if(modify_signal == 0){
        tree.on('selectNode', function(e){
            if (e.nodes[0] == "0"){
                go_to_root();
            }
            else if (e.nodes.length > 0)
                set_hard_focus(e.nodes[0]);
        });
        tree.on('doubleClick', function(e){
            if (chat_type === 'graph') {
                for (var i = 0; i < e.nodes.length; i++)
                    if(other_parents.indexOf(e.nodes[i]) === -1) {
                        msg_id = e.nodes[i];
                        other_parents.push(msg_id);
                        $('#other-parents').append(make_op_li(msg_id));
                    }
            }
        });
        /*tree.on('deselectNode', function(e){
            // if nothing new is selected, then don't deselect
            // If the root was selected, then don't deselect
            //if(e.nodes.length === 0 || e.nodes.indexOf("0") > -1)
                //tree.setSelection(e.previousSelection);
            //else if (chat_type === 'graph') {
            if (chat_type === 'graph') {
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
        });*/
    }else{
        // first select a child node and then double click parents.
        tree.on('selectNode', function(e){
            if(e.nodes[0] == undefined || e.nodes[0] == null)
                return;
            if(e.nodes[0] != "0"){
                if(messages[e.nodes[0]].author == username)
                    latest_child.push(e.nodes[0]);
            }
        });
        tree.on('doubleClick', function(e){
            if(e.nodes[0] == undefined || e.nodes[0] == null)
                return;
            if(e.nodes[0] != "0"){
                if(messages[e.nodes[0]].author == username)
                    latest_child.pop();
            } 
            if(latest_child.length == 0)
                return;
            lchild = latest_child[latest_child.length-1];
            if (change_parent[lchild] == undefined || change_parent[lchild] == null)
                change_parent[lchild] = [];

            if (chat_type == 'graph') {
                var seen = 0;
                change_parent[lchild].forEach(function(msg_id){
                    if (msg_id == e.nodes[0])
                        seen = 1;
                })
                if (seen == 0)
                    change_parent[lchild].push(e.nodes[0]);
                // once user choose root, before they finish this change, the node cannot have other parents any more.
                change_parent[lchild].forEach(function(p){
                    if(p == "0")
                        change_parent[lchild] = ["0"];
                });
                if(seen == 1 && change_parent[lchild].length > 1){
                    change_parent[lchild] = change_parent[lchild].filter(pid => pid != "0");
                }
            }
            else{
                change_parent[lchild] = [e.nodes[0]];
            }
            modify_tree_hierarchy(lchild, change_parent[lchild]);
        });
    }
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

var modify_msg_hierarchy = function(child_id, parent_ids){
    if(parent_ids == undefined || parent_ids == null)
        return;

    if(messages[child_id].msg_parent == undefined || messages[child_id].msg_parent == null){
        channel.top_lvl_messages = channel.top_lvl_messages.filter(msg => msg != child_id);
    }else{
        messages[messages[child_id].msg_parent].children = messages[messages[child_id].msg_parent].children.filter(child => child != child_id);
        messages[child_id].other_parents.forEach(function(pid){
            messages[pid].children = messages[pid].children.filter(child => child != child_id);
        });
    }
    
    messages[child_id].msg_parent = null;
    messages[child_id].other_parents = [];
    if(parent_ids[0] == "0"){
        var seen = 0;
        channel.top_lvl_messages.forEach(function(msg){
            if(msg == child_id)
                seen = 1;
        });
        if(seen == 0)
            channel.top_lvl_messages.push(child_id);
    }
    else{
        //parent_ids = parent_ids.filter(id => id != "0");
        for(var i = 0; i < parent_ids.length; i ++){
            messages[parent_ids[i]].children.push(child_id);
            if (i == 0)
                messages[child_id].msg_parent = parent_ids[0];
            else
                messages[child_id].other_parents.push(parent_ids[i]);
        };
    };
};

var modify_tree_hierarchy = function(child_id, parent_ids){
    var original_parent = [];
    if(messages[child_id].msg_parent != null || messages[child_id].msg_parent != undefined)
        original_parent.push(messages[child_id].msg_parent);
    if(messages[child_id].other_parents != null || messages[child_id].other_parents != undefined)
        if(messages[child_id].other_parents.length > 0)
            messages[child_id].other_parents.forEach(id => original_parent.push(id));
    //console.log(original_parent);
    $.ajax({
        url:"/modify_hierarchy",
        type:"POST",
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        data : JSON.stringify({'child_id':child_id, 'parent_ids':parent_ids, 'channel':channel._id, 'original_parent': original_parent}),
        success: function(data){
            modify_msg_hierarchy(child_id, parent_ids);
            modify_hierarchy(data);
        },
    });
};

var modify_hierarchy = function(data){
    var child_id = data.child_id;
    var parent_ids = data.parent_ids;
    messages[child_id].original_version.push(data.record);
    modify_msg_hierarchy(child_id, parent_ids);
    if(channel.tree_views && tree){
        tree.destroy();
    };
    build_tree();
    display_tree();   
    set_hard_focus(child_id);  
    if(messages[child_id].author != username && chat_type != 'path'){
        queue.push(messages[child_id]);
        $('#queue-length').html('('+queue.length+')');
        clearInterval(new_message_flash);
        new_message_flash = setInterval(message_flash, 700);
        update_queue_display();
    }  
};

var edit_msg_content = function(id, content){
    $.ajax({
        type : "POST",
        url  : '/edit_content',
        data : JSON.stringify({'msg': content, 'id': id, 'channel':channel._id}),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function(data){
            $('#message').focus();
            $('.message-selected .msg_content p').html(data.msg);
            $('#'+data.id).attr('author', messages[data.id].author+' (edited)');
        }
    });
};

var update_content = function(msg){
    messages[msg._id].content = msg.content;
    messages[msg._id].original_version = msg.original_version;
    //messages[msg._id].author = msg.author + ' (edited)';
    set_hard_focus(hard_focus);

    if(msg.author != username && chat_type != 'path'){
        queue.push(msg);
        $('#queue-length').html('('+queue.length+')');
        clearInterval(new_message_flash);
        new_message_flash = setInterval(message_flash, 700);
        update_queue_display();
    }
};

var handle_keydown_editbox = function(e){
    var code = e.keyCode || e.which;
    if (code === 13){
        e.preventDefault();
        document.execCommand('insertHTML', false);
    }
    var id = $('.message-selected').attr('id').replace('-wrapper', '');
    var content = $('.message-selected .msg_content p').text().trim()
                                                     .replace('&','&amp;')
                                                     .replace('<','&lt;')
                                                     .replace('>','&gt;');
    if (content != messages[id].content & code === 13){
        if(content == '' || content == undefined || content == null)
            content = messages[id].content;
        edit_msg_content(id, content);
    }
}

var search_keydown = function(e){
    var field = $("#field-dropdown option:selected").text();
    var search_content = $("#search-context").val();
    var code = e.keyCode || e.which;
    if(search_content.length > 0){
        if(code == 13){
            display_popup_msg(search_message(field, search_content), 'search-modal');
            return;
        }
    }
}

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
            //to_right_sibling();
            // If the message has a plus, then make it the hard focus
            // Two cases to have a plus:
            //    On the path to root and have >= 2 children
            //    A child message with >= 1 children
            set_hard_focus(get_soft_focus()); 
            /*var sf = get_soft_focus();
            var sf_children = messages[sf].children.length;

            if(sf_children > 1 || 
               ($('#'+sf).hasClass('child-message') && sf_children > 0)){
                set_hard_focus(sf);
            }*/
            break;
        case 40: // down
            arrow_down();
            //descend_from_soft_focus();
            break;
        default:
            if(chat_type != 'path')
                set_hard_focus(get_soft_focus(), null, '0');
            break;
    }
};

//----------------------------------------------------



$(document).ready(function(){
    var q = "username="+username+"&channel="+channel._id;
    socket = io(socket_url, {query:q});
    socket.on('message',receive_msg);
    socket.on('likes', receive_likes);
    socket.on('edited_content', update_content);
    socket.on('modify_hierarchy', modify_hierarchy);
    socket.on('stop_experiment', stop_experiment);

    socket.on('log-on',user_log_on);
    socket.on('log-off',user_log_off);

    if(guidance_popup)
        $("#guidance-modal").foundation('reveal', 'open');

    $('#message-send').on('click',function(){
        if($('#message').val().trim())
            send_message();
        else
            next_msg();
    });

    $('.message .view').on('click',function(){
        set_hard_focus($(this).attr('id'));
    });

    // make the channel name go to the root if we're not in
    if(chat_type !== 'path')
        $('#channel-name').on('click',function(){
            hard_focus=null;
            go_to_root();
    });

    $('#backward').on('click',back);
    $('#forward').on('click',forward);

    $('a#mail').on('click',next_msg);
    
    $(document).on('keydown','.message-selected .msg_content p', handle_keydown_editbox);
    $('textarea#message').on('keydown',handle_keydown);
    // clear key in keys dict on key up
    $('textarea#message').on('keyup', function(e){
        var code = e.keyCode || e.which;
        delete keys[code];
    });
    $('#search-context').on('keydown',search_keydown);

    assign_color();
    update_online();
    if(channel.type != 'routine')
        waiting_time;

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
        //if($("#search-modal").attr('aria-hidden') == false)
            //$('#').focus();
        if(!$('#extra-parent').is(':focus') && !$('p').is(':focus') && !$("#search-context").is(':focus') && !$("#field-dropdown").is(':focus')) 
            //!$('#invite-username').is(':focus') &&
            //!$('#invite-password').is(':focus'))
            $('#message').focus();
    });
    $('#message').focus();

    build_tree();
    display_tree();
    if(channel.tree_views == false){
        if(chat_type == 'graph')
            $("#graph-tree").hide();
        else if(chat_type == 'tree')
            $("#tree").hide();
    }

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
            for(var j=queue.length-1;j>=0;j--){
                add_msg_to_hover_list(queue[j]);
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

    $(document).on('closed.fndtn.reveal', '[data-reveal]', function () {
        $('#invite-username').val('');
        //$('#invite-password').val('');
        $('#invite-link').html('');
    });

    $(document).on('opened.fndtn.reveal', '[data-reveal]', function () {
      var modal = $("#invite-modal");
      modal.find('#invite-username').focus();
    });
    
    $(document).on('click', '.op-x', function(e) {
        var msg_id = $(this).attr('id').substr(3);
        remove_parent(msg_id);
    });

    // likes feature
    $(document).on('click', '.msg_likes', function(){
        var msg_id = $(this).attr('msg_id');
        $.ajax({
            url:"/likes",
            type:"POST",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data : JSON.stringify({"msg_id": msg_id, "user": username, "channel": channel._id}),
        }).success(function(data){
            var likes_div = $("#msg_likes-"+msg_id);
            likes_div.empty();
            if (data['length'] > messages[msg_id].likes.length)
                likes_div.append('<i class="fa fa-thumbs-up fa-lg"></i><p id="likes-p-'+msg_id+'">  '+data.length+' likes</div>');
            else
                likes_div.append('<i class="fa fa-thumbs-o-up fa-lg"></i><p id="likes-p-'+msg_id+'">  '+data.length+' likes</div>');
        });
    });

    $(document).on('click', '.bookmarked', function(){
        var msg_id = $(this).attr('id').replace('bookmarked-','');
        $.ajax({
            url:"/bookmark",
            type:"POST",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data : JSON.stringify({"msg_id": msg_id, "user": username}),
        }).success(function(data){
            var bookmark_div = $("#bookmarked-"+msg_id);
            bookmark_div.empty();
            if (data.bookmarked == true){
                messages[msg_id].bookmarked.push(username);
                bookmark_div.append('<i class="fa fa-bookmark fa-lg"></i>');
            }
            else{
                messages[msg_id].bookmarked = messages[msg_id].bookmarked.filter(user => user != username);
                bookmark_div.append('<i class="fa fa-bookmark-o fa-lg"></i>');
            }
        });
    });    
        
    // show help dialog
    if(help_popup)
        $('#help-modal').foundation('reveal', 'open');

    $(document).on('click', '#online-users-list > li', function(){
        var uname = $(this).text().replace(' (online)', '');
        display_popup_msg(get_msg_by_author(uname), 'user-modal');
    });

    $('#likes-ranking').on('click',function(){
        display_popup_msg(get_ranking(), 'ranking-modal');
    });

    $('#bookmark-list').on('click',function(){
        display_popup_msg(get_bookmark_message(username), 'bookmark-modal');
    });

    $(document).on('click', "#search-submit", function(){
        var field = $("#field-dropdown option:selected").text();
        var search_content = $("#search-context").val();
        display_popup_msg(search_message(field, search_content), 'search-modal');
    });

    $('#sequential').on('click',function(){
        display_popup_msg(get_sequential_message(), 'sequential-modal');
    });

    $(document).on('click', '#modal-msg .message', function(){
        set_hard_focus($(this).attr('id'));
        $('#modal-msg').foundation('reveal', 'close');
    });

    $('#invite-button').on('click', function(e){
        e.preventDefault();
        var data = {
              'channel': channel._id,
        };
        $.ajax({
            type : "POST",
            url  : '/makeinvite',
            data : JSON.stringify(data),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
        }).success(function(data){
            $('#invite-link').html(get_invite_link(data.invite))
        }).fail(function(){
            $('#error').html("User doesn't exists");
            $('#invite-link').html("");
        }).always(function(){
            $('#gen-link').prop('disabled', false);
        });
    });

    back_home();
    $("#logout-close").on('click',function(){
        $("#logout-modal").foundation('reveal', 'close');
    });

    $('#modify-button').on('click',function(){
        if(modify_signal == 1){
            $(this).html('Modify');
            modify_signal = 0;
            change_parent = {};
            latest_child = [];
            display_tree();
        }
        else{
            $(this).html('Finish');
            modify_signal = 1;
            change_parent = {};
            latest_child = [];
            display_tree();
            //set_hard_focus(hard_focus);
        }
    });
});

