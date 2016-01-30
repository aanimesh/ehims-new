var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var MessageSchema = new Schema({
    id: ObjectId,
    content: String,
    channel: String,
    author: String,
    msg_parent: this,
    children: [ this ],
    seen_by : [ {type: ObjectId, ref: 'User'} ]
}, { timestamps: { createdAt: 'created_at' } });

exports.Message = mongoose.model('Message', MessageSchema);

