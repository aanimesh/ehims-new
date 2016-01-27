var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var MessageSchema = new Schema({
    id: ObjectId,
    content: String,
    author: {type: ObjectId, ref: 'User'},
    msg_parent: this,
    children: [ this ],
    seen_by : [ {type: ObjectId, ref: 'User'} ]
});

exports.Message = mongoose.model('Message', MessageSchema);

