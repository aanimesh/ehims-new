var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var UserSchema = new Schema({
    id: ObjectId,
    name: { type: String, required: true, unique: true},
    channels : [{name: {type: String}, id:{type: ObjectId, ref: 'Channel'}}]
});

UserSchema.methods.join_channel = function(channel){
    var seen = false;
    for(var i = this.channels.length-1;  i >= 0; i--)
        if(this.channels[i].id.equals(channel._id))
            seen = true;

    if(!seen)
        this.channels.push({name:channel.name, id:channel._id});

    this.save();
};

exports.User = mongoose.model('User', UserSchema);

