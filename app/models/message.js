var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var MessageSchema = new Schema({
    id: ObjectId,
    content: String,
    channel: {type: ObjectId, ref: 'Channel'},
    author: String,
    msg_parent: this,
    other_parents: [ this ],
    children: [ this ],
    seen_by : [ {type: ObjectId, ref: 'User'} ],
    likes: [String],
    bookmarked: [ String ],
}, { timestamps: { createdAt: 'created_at' } });


exports.Message = mongoose.model('Message', MessageSchema);

