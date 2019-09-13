var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var ChannelSchema = new Schema({
    id: ObjectId,
    name: {type: String, required: true, unique: true},
    //online_users : [{type: ObjectId, ref: 'User'}],
    top_lvl_messages : [{type: ObjectId, ref: 'Message'}],
    chat_type: {type: String, enum: ['path', 'tree', 'graph'], default: 'tree'},
    schedule_time : String,
    participants: [{name: String, online: Boolean, color: Number, id: {type: ObjectId, ref: 'User'}}],
    type: {type: String, enum: ['experiment', 'routine', 'result'], default: 'routine'},
    group_no: Number,
    tree_views: {type: Boolean, default: true},
    users_number: Number,
    started_at: String,
    invite_link: [{type: ObjectId, ref: 'Invite'}],
}, { timestamps: { createdAt: 'created_at'} });


ChannelSchema.methods.log_user_in = function(user){
    var seen = false;
    var length = this.participants.length;
    for(var i = length-1; i >= 0; i--)
        if(this.participants[i].id.equals(user._id) || this.participants[i].id === user._id){
            seen = true;
            this.participants[i].online = true;
            break;
        }
    if(!seen) 
        this.participants.push({id: user._id, color: length, online: true, name: user.name});
    console.log("Logging user in");
    this.save();
};

ChannelSchema.methods.log_user_out = function(user){
    channel.participants.forEach(function(dict){
        if (dict.id == user._id)
            dict.online = false;
    })
    this.save();
};


exports.Channel = mongoose.model('Channel',ChannelSchema);

