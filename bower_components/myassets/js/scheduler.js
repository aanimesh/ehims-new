var register = function(participants, users_number, channel_id){
	$("#participants-"+channel_id).html(participants+'/'+users_number);
};


$(document).ready(function(){
    var q = "username="+user.name;
	var socket = io(socket_url, {query:q});
	socket.on('register', register);

    $(document).on('click', '#register', function(){
        var channel_id = $(this).attr('channel');
        var username = $(this).attr('user');
        $.ajax({
            url:"/register",
            type:"POST",
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data : JSON.stringify({'channel': channel_id, 'username':username}),
        }).success(function(data){
        	$("#test-channels > tr").each(function(index){
        		var button = $($(this).find("td:last"));
        		button.empty();
        		if($(this).attr("id") == channel_id){
                    var channel_field = document.getElementById("channel-id");
                    channel_field.setAttribute('value', channel_id);
        			button.append('<td><a onclick="document.getElementById('+"'goto-presurvey-form'"+').submit();"><button class="tiny" id="presurvey" channel="#{channel._id}" user="#{user.name}"> Pre Survey </button></a></td>');
                }
        	})
        });
    });
})
