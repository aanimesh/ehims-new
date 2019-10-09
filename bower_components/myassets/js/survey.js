$(document).ready(function(){
	$("#presurvey-submit").on('click', function(e){
		var checkboxes = $(".checkbox");
		var checked = false;
		$.each(checkboxes, function(i, boxes){
			var child = $(this).children('input');
			checked = false;
			$(child).each(function(index){
				if($(this).is(':checked'))
					checked = true;
			});
		})
		if(checked == false){
			alert("Please check the checkbox");
			return;
		}
	});
	$("#postsurvey-submit").on('click', function(e){
		var checkboxes = $(".checkbox");
		var checked = false;
		$.each(checkboxes, function(i, boxes){
			var child = $(this).children('input');
			checked = false;
			$(child).each(function(index){
				if($(this).is(':checked'))
					checked = true;
			});
		})
		if(checked == false){
			alert("Please check the checkbox");
			return;
		}
	});
});
