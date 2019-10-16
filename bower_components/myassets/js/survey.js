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
		});
		$(".star_ranking").each(function(index){
			if($(this).val() == undefined || $(this).val() == null || $(this).val() == ""){
				checked = false;
			}
		});
		if(checked == false){
			e.preventDefault();
			alert("Please answer all the questions");
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
		});
		$(".star_ranking").each(function(index){
			if($(this).val() == undefined || $(this).val() == null || $(this).val() == ""){
				checked = false;
			}
		});
		if(checked == false){
			e.preventDefault();
			alert("Please answer all the questions");
			return;
		}
	});

	$(".fa-xs").on('click', function(){
		var cur = $(this);
		var cnt = 0;
		if(cur.hasClass('star_check')){
			cur.siblings().removeClass('fa-circle');
			cur.siblings('.fa-xs').addClass('fa-circle-o');
			cur.siblings().removeClass('star_check');
		};
		for(var i=0;i < 10; i++){
			cnt ++;
			cur.addClass('star_check');
			cur.addClass('fa-circle');
			cur.removeClass('fa-circle-o');
			cur = cur.prev();
			if(cur.attr('name'))
				break;
		}
		cur.val(cnt);
	});
});
