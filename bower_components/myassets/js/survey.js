$(document).ready(function(){
	$("#presurvey-submit").on('click', function(){
		var form = $("input");
		var data = {};
		data['presurvey'] = [];
		form.each(function(index){
			switch(index){
				case 0:
					data['channel'] = $(this).val();
					break;
				case 1:
					data['username'] = $(this).val();
					break;
				default:
					data['presurvey'].push({'label':$(this).attr('label'), 'answer':$(this).val(), 'name':$(this).attr('name')});
			}
		});

		console.log(data);

		/*$.ajax({
            type : "POST",
            url  : '/presurvey_login',
            data : JSON.stringify(data),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
        });*/
	})
});
