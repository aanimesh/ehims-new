var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var SurveySchema = new Schema ({
	id: ObjectId,
	channel:{type: ObjectId, ref: 'Channel'},
	user: {type: ObjectId, ref: 'User'},
	questionnaire: {type: Boolean, default: false},
	pre_survey: [{lable: String, index: String, answer:String}],
	post_survey: [{lable: String, index: String, answer:String}],
	consent: String,
	instructions: String,
});

exports.Survey = mongoose.model('Survey', SurveySchema);




