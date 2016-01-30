var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var ChannelSchema = new Schema({
    id: ObjectId,
    name: {type: String, required: true, unique: true},
    online_users : [{type: ObjectId, ref: 'User'}],
    top_lvl_messages : [{type: ObjectId, ref: 'Message'}]
});

ChannelSchema.methods.log_user_in = function(user){
    var seen = false;
    for(var i = this.online_users.length-1; i >= 0; i--)
        if(this.online_users[i].equals(user._id)){
            seen = true;
            break;
        }
    if(!seen)
        this.online_users.push(user._id);

    this.save();
};

ChannelSchema.methods.log_user_out = function(user){
    var index = -1;
    for(var i = this.online_users.length-1; i >= 0; i--)
        if(this.online_users[i].equals(user._id)){
            index = i;
            break;
        }
    if(index >= 0)
        this.online_users.splice(index, 1);

    this.save();
};


exports.Channel = mongoose.model('Channel',ChannelSchema);

