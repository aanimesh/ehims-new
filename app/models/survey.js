var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var SurveySchema = new Schema ({
	id:ObjectId,
	pre_survey: [String],
	post_survey: [String],
	consent: String,
});

exports.Survey = mongoose.model('Survey', SurveySchema);




