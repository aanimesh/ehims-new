var add_group = function(group_id, channel_id){
    var time = new Date().toLocaleString("en-US", { timeZone: 'America/Montreal' });
    var group_container = $('#group-details');
    var row = $("<tr>", {channel_id: channel_id, group_id:group_id});
    row.append('<td style="text-align: center"><i class="fa fa-times fa-lg"></i></td>');
    row.append("<td width='100' style='text-align: center'>"+group_id+"</td>");
    row.append("<td id='time-"+channel_id+"' width='100' style='text-align: center' contenteditable='true'>"+time+"</td>");
    row.append("<td width='100' style='text-align: center' contenteditable='true' id='number-"+channel_id+"'>3</td>");

    var chat_td = $('<td>', {id:'chat_type_td-'+channel_id});
    var chat_type = $('<form>', {id:'chat_type-'+channel_id});
    chat_type.append('<input type="radio" name="ctype" value="path"><label>Sequential</label><br>');
    chat_type.append('<input type="radio" name="ctype" value="tree" checked><label>Tree</label><br>');
    chat_type.append('<input type="radio" name="ctype" value="graph"><label>Graph</label>');
    chat_td.append(chat_type);
    row.append(chat_td);
    row.append('<td id="tree_views_td-'+channel_id+'"><input id="tree_views-'+channel_id+'" type="checkbox" style="position: relative;top: 10px;left: 20px;transform:scale(1.5, 1.5);"></td>');
    row.append('<td id="status-'+channel_id+'" style="text-align: center">Not started</td>');
    row.append('<td id="completed-'+channel_id+'" style="text-align: center">0</td>');
    row.append('<td id="create-group-cell-'+channel_id+'" style="overflow: auto"><button class="small" id="create-group">Create</button></td>');
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
	$('#time-'+channel._id).attr('contenteditable', 'false');
    $('#time-'+channel._id).html(channel.started_at);
    $('#chat_type_td-'+channel._id).html(channel.chat_type);
	$('#chat_type_td-'+channel._id).css('text-align', 'center');
    if (channel.tree_views == false)
        $('#tree_views_td-'+channel._id).html('false');
    else
        $('#tree_views_td-'+channel._id).html(channel.tree_views);
    $('#tree_views_td-'+channel._id).css('text-align', 'center');

    if(channel.status == 'in progress')
        $('#status-'+channel._id).html("Ongoing");
    else if (channel.status == 'result')
        $('#status-'+channel._id).html("Finished");
    var post_count = 0;
    for(var i = 0; i < channel.participants.length; i++){
        if(channel.participants[i].postsurvey != undefined && channel.participants[i].postsurvey != null){
            if(channel.participants[i].postsurvey == true){
                post_count += 1
            }
        }
    }
	$('#completed-'+channel._id).html(post_count);

	$('#create-group-cell-'+channel._id).html(get_invite_link(invite_id));
	$('#create-group-cell-'+channel._id+'> button').css('display', 'none');
    $('#download-'+channel._id).html('<button class="tiny" style="left: 4%"><a href="'+get_download_link(channel._id)+'" target="_blank">Download</a></button>');
}

var create_survey_consent = function(consent){
    $("#survey").empty();
    $("#survey").append('<p id="consent_content" contenteditable="true" style="border:1px solid lightgray;padding:10px">'+consent+'</p>');
}

var create_instructions = function(instructions){
    $("#survey").empty();
    $("#survey").append('<p id="instructions" contenteditable="true" style="border:1px solid lightgray;padding:10px">'+instructions+'</p>');
}

var create_survey_question = function(pre_survey, content){
    $("#survey").empty();
    var table = $('<table>', {class: "large-12 medium-12 small-12"});
    table.append('<thead><tr><th width="50"></th><th width="50" style="text-align: center">No.</th><th style="text-align: center">Question</th>');
    var tbody = pre_survey == 1 ? $("<tbody>", {id: "pre_survey"}) : $("<tbody>", {id: "post_survey"});

    for(var i = 0; i < content.length; i ++){
        var tr = $("<tr>");
        tr.append('<td style="text-align: center"><i class="fa fa-times fa-lg"></i></td>');
        tr.append('<td style="text-align: center">'+(i+1).toString()+'</td>');
        tr.append('<td contenteditable="true">'+content[i]+'</td>');
        tbody.append(tr);
    }
    table.append(tbody);
    $("#survey").append(table);
}

var get_survey_question = function(pre_survey){
    var tbody = pre_survey == 1 ? $("#pre_survey") : $("#post_survey");
    var tr = tbody.find("tr");
    var questions = [];
    tr.each(function(i){
        var question = $(this).children("td")[2];
        questions.push($(question).html());
    });
    return questions;
}

var update_survey_question = function(seleted_page){
    var consent = survey_contents.consent;
    var instructions = survey_contents.instructions;
    var pre_survey = survey_contents.pre_survey;
    var post_survey = survey_contents.post_survey;
    switch(seleted_page){
        case 1:
            consent = $('#consent_content').html().replace('<div>', '<br>').replace('</div>', '');
            break;
        case 2:
            pre_survey = get_survey_question(1);
            break;
        case 3:
            post_survey = get_survey_question(0);
            break;
        case 4:
            instructions = $('#instructions').html().replace('<div>', '<br>').replace('</div>', '');
            break;
        default:
            break;
    }
    $.ajax({
        url:"/update_survey",
        type:"POST",
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        data: JSON.stringify({'consent': consent, 'pre_survey': pre_survey, 'post_survey': post_survey, 'instructions':instructions})
    }).success(data => {
        survey_contents = data;
        create_survey_div(seleted_page);
        $("button").css('background-color', '#008CBA');
    });
}

var create_survey_div = function(seleted_page){
    switch(seleted_page){
        case 1:
            create_survey_consent(survey_contents.consent);
            break;
        case 2:
            create_survey_question(1, survey_contents.pre_survey);
            break;
        case 3:
            create_survey_question(0, survey_contents.post_survey);
            break;
        case 4:
            create_instructions(survey_contents.instructions);
        default:
            break;
    }
}

var update_group_no = function(table){
    var tbody;
    switch(table){
        case 0:
            tbody = $("#group-details");
            break;
        case 1:
            tbody = $("#pre_survey");
            break;
        case 2:
            tbody = $("#post_survey");
            break;
    }
    tbody.find("tr").each(function(index){
        //alert(index);
        $($(this).find("td")[1]).html((index+1).toString());
    })
}

var add_question = function(seleted_page){
    var tbody = seleted_page == 2 ? $("#pre_survey") : $("#post_survey");
    var content = seleted_page == 2 ? survey_contents.pre_survey : survey_contents.post_survey;
    content.push('*'+content.length+"*");
    var tr = $("<tr>");
    tr.append('<td style="text-align: center"><i class="fa fa-times fa-lg"></i></td>');
    tr.append('<td style="text-align: center">'+content.length+'</td>');
    tr.append('<td contenteditable="true"></td>');
    tbody.append(tr);
}

var sub_question = function(seleted_page){
    var tbody = seleted_page == 2 ? $("#pre_survey") : $("#post_survey");
    var content = seleted_page == 2 ? survey_contents.pre_survey : survey_contents.post_survey;
    tbody.find("tr:last").remove();
    content.pop();
}

var status_update = function(channel_id, status, finish, duration){
    var row = $("[channel_id="+channel_id+"]").find('td');
    if(duration)
        $(row[6]).text(status+' ('+duration+' min)');
    else if (status)
        $(row[6]).text(status);
    if(finish)
        $(row[7]).text(finish);
}

$(document).ready(function(){
    var socket = io(socket_url, {query:"admin=admin"});
    socket.on('status_update', status_update);

    // add a group in html
    $('#add-group').on('click', function(e){
    	var time = new Date().toLocaleString("en-US", { timeZone: 'America/Montreal' });
        e.preventDefault();
        $.ajax({
            url:"/add_group",
            type:"POST",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data : JSON.stringify({'time': time}),
        }).success(function(data){
            var channel = data['channel'];
            var group_id = channels.length+1;
            add_group(group_id, channel._id);
            channels.push(channel);
        });
    });

    $('#sub-group').on('click', function(e){
        var group_no = $("#group-details > tr:last").find('td')[1];
        var id = channels[parseInt($(group_no).text())-1]._id;
        e.preventDefault();
        $.ajax({
            url:"/sub_group",
            type:"POST",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data : JSON.stringify({id: id}),
        }).success(function(data){
            $("#group-details > tr:last").remove();
            channels.pop();
        });
        
    });

    $(document).on('click', "#group-details i", function(e){
        var row = $(this).closest("tr");
        var group_no = $(this).closest("tr").find('td')[1];
        var id = channels[parseInt($(group_no).text())-1]._id;
        e.preventDefault();
        $.ajax({
            url:"/sub_group",
            type:"POST",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data : JSON.stringify({id: id}),
        }).success(function(data){
            row.remove();
            channels = channels.filter(channel => channel._id != id);
            update_group_no(0);
        });
    });

    //iteract with db
    $(document).on('click', '#create-group', function(e){
    	var chat_type;
    	var tree_views = new Boolean(false);
    	var channel_id = $(this).closest("tr").attr('channel_id');
    	var group_no = $(this).closest("tr").attr('group_id');
    	var number = $('#number-'+channel_id).text();
        var time = new Date($('#time-'+channel_id).text()).toLocaleString("en-US");
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
    	};
        e.preventDefault();
        $.ajax({
            url:"/create_group",
            type:"POST",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data : JSON.stringify(data),
        }).success(function(result){
        	data = result['invite'];
            var channel_info = data['channel'];
        	fixed_configuration(data);
            channels = channels.filter(channel => channel._id != channel_info._id);
            channels.push(channel_info);
    	});
    });

    $("#seleted-page").on('change', function(){
        var seleted_page = parseInt($(this).val());
        create_survey_div(seleted_page);
    });

    $("#save-survey").on('click', function(){
        var seleted_page = parseInt($("#seleted-page").val());
        update_survey_question(seleted_page);
    });

    $("#add-question").on('click', function(){
        var seleted_page = parseInt($("#seleted-page").val());
        if(seleted_page == 1 || seleted_page == 0)
            return;
        add_question(seleted_page);
    });

    $("#sub-question").on('click', function(){
        var seleted_page = parseInt($("#seleted-page").val());
        if(seleted_page == 1 || seleted_page == 0)
            return;
        sub_question(seleted_page);
    });

    $(document).on('click', '#pre_survey i', function(){
        var tr = $(this).closest("tr");
        var no = $(tr.find("td")[1]).html();
        survey_contents.pre_survey.splice(parseInt(no)-1, 1);
        tr.remove();
        update_group_no(1);
    });

    $(document).on('click', '#post_survey i', function(){
        var tr = $(this).closest("tr");
        var no = $(tr.find("td")[1]).html();
        survey_contents.post_survey.splice(parseInt(no)-1, 1);
        tr.remove();
        update_group_no(2);
    });

    $("#search-survey-code").on('click', function(){
        var code = $("input[name='survey-code']").val();
        $.ajax({
            url:"/search_code",
            type:"POST",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data : JSON.stringify({code:code}),
        }).success(function(judgement){
            $("#user-info").html(judgement);
        })
    })

})

