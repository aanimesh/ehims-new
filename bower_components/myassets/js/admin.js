var add_group = function(group_id, channel_id){
    var time = new Date().toLocaleString("en-US", {timeZone: "America/Montreal"});
    var group_container = $('#group-details');
    var row = $("<tr>", {channel_id: channel_id, group_id:group_id});
    row.append("<td width='100' style='text-align: center'>"+group_id+"</td>");
    row.append("<td id='time-"+channel_id+"' width='100' style='text-align: center'>"+time+"</td>");
    row.append("<td width='100' style='text-align: center' contenteditable='true' id='number-"+channel_id+"'>3</td>");

    var chat_td = $('<td>', {id:'chat_type_td-'+channel_id});
    var chat_type = $('<form>', {id:'chat_type-'+channel_id});
    chat_type.append('<input type="radio" name="ctype" value="path"><label>Sequential</label><br>');
    chat_type.append('<input type="radio" name="ctype" value="tree" checked><label>Tree</label><br>');
    chat_type.append('<input type="radio" name="ctype" value="graph"><label>Graph</label>');
    chat_td.append(chat_type);
    row.append(chat_td);
    row.append('<td id="tree_views_td-'+channel_id+'"><input id="tree_views-'+channel_id+'" type="checkbox" style="position: relative;top: 10px;left: 45px;transform:scale(1.5, 1.5);"></td>');
    row.append('<td id="create-group-cell-'+channel_id+'"><button class="small" id="create-group">Create</button></td>');
    row.append('<td id="download-'+channel_id+'"></td>');

    group_container.append(row);
};

var get_invite_link = function(invite){
    var base = location.protocol + '//' + location.host + '/invite';
    return base + '?i=' + encodeURIComponent(invite);
};

var get_download_link = function(channel_id){
    return location.protocol + '//' + location.host + '/download?channel=' + channel_id;
}

var fixed_configuration = function(data){
	var channel = data['channel'];
	var invite_id = data['invite'];
	$('#number-'+channel._id).html("<td width='100' style='text-align: center' contenteditable='false' id='number-"+channel._id+"'>"+channel.users_number+"</td>");
	$('#time-'+channel._id).html(channel.started_at);
    $('#chat_type_td-'+channel._id).html(channel.chat_type);
	$('#chat_type_td-'+channel._id).css('text-align', 'center');
    if (channel.tree_views == false)
        $('#tree_views_td-'+channel._id).html('false');
    else
        $('#tree_views_td-'+channel._id).html(channel.tree_views);
	$('#tree_views_td-'+channel._id).css('text-align', 'center');
	$('#create-group-cell-'+channel._id).html(get_invite_link(invite_id));
	$('#create-group-cell-'+channel._id+'> button').css('display', 'none');
    $('#download-'+channel._id).html('<button class="small"><a href="'+get_download_link(channel._id)+'" target="_blank">Download</a></button>');
}

$(document).ready(function(){

    // add a group in html
    $('#add-group').on('click', function(e){
    	var time = new Date().toLocaleString("en-US", {timeZone: "America/Montreal"});
        e.preventDefault();
        $.ajax({
            url:"/add_group",
            type:"POST",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data : JSON.stringify({'time': time}),
        }).success(function(data){
            var channel_id = data['channel_id'];
            var group_id = data['group_id'];
            add_group(group_id, channel_id);
        });
    });

    $('#sub-group').on('click', function(e){
        e.preventDefault();
        $.ajax({
            url:"/sub_group",
            type:"POST",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data : JSON.stringify({}),
        });
        $("#group-details > tr:last").remove();
    });

    //iteract with db
    $(document).on('click', '#create-group', function(e){
    	var time = new Date().toLocaleString("en-US", {timeZone: "America/Montreal"});
    	var chat_type;
    	var tree_views = new Boolean(false);
    	var channel_id = $(this).closest("tr").attr('channel_id');
    	var group_no = $(this).closest("tr").attr('group_id');
    	var number = $('#number-'+channel_id).text();
    	$('#chat_type-'+channel_id).find('input').each(function(index){
    		if ($(this).is(":checked"))
    			chat_type = $(this).val();
    	});
    	if ($('#tree_views-'+channel_id).is(":checked"))
    		tree_views = true;
    	var data = {
    		chat_type: chat_type,
    		tree_views: tree_views,
    		channel_id: channel_id,
    		number: number,
    		time: time,
    		group_no: group_no,
    	};
        e.preventDefault();
        //alert(JSON.stringify(data));
        $.ajax({
            url:"/create_group",
            type:"POST",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data : JSON.stringify(data),
        }).success(function(result){
        	data = result['invite'];
        	fixed_configuration(data);
    	});
    })
})

