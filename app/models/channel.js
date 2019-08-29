var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var ChannelSchema = new Schema({
    id: ObjectId,
    name: {type: String, required: true, unique: true},
    online_users : [{type: ObjectId, ref: 'User'}],
    top_lvl_messages : [{type: ObjectId, ref: 'Message'}],
    chat_type: {type: String, enum: ['path', 'tree', 'graph'], default: 'tree'},
});

ChannelSchema.methods.log_user_in = function(user){
    var seen = false;
    for(var i = this.online_users.length-1; i >= 0; i--)
        if(this.online_users[i].equals(user._id) || this.online_users[i] === user._id){
            seen = true;
            break;
        }
    if(!seen) {
        console.log("Logging user in");
        this.online_users.push(user._id);
    }

    this.save();
};

ChannelSchema.methods.log_user_out = function(user){
    for(var i = this.online_users.length-1; i >= 0; i--)
        if(this.online_users[i].equals(user._id)){
            this.online_users.splice(i, 1);
        }

    this.save();
};


exports.Channel = mongoose.model('Channel',ChannelSchema);

