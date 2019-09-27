var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var SurveySchema = new Schema ({
	id:ObjectId,
	user: {type: ObjectId, ref: 'User'},
	questionnaire: {type: Boolean, default: false},
	pre_survey: [String],
	post_survey: [String],
	consent: String,
	instructions: String,
});

exports.Survey = mongoose.model('Survey', SurveySchema);




