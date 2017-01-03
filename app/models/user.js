var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;
var SALT_WORK_FACTOR = 10;

// Password stuff taken from: 
// http://devsmash.com/blog/password-authentication-with-mongoose-and-bcrypt


var UserSchema = new Schema({
    id: ObjectId,
    name: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    channels : [{
        name: {type: String}, 
        chat_type: {type: String}, 
        id:{type: ObjectId, ref: 'Channel'}}]
});

UserSchema.methods.join_channel = function(channel){
    var seen = false;
    for(var i = this.channels.length-1;  i >= 0; i--)
        if(this.channels[i]._id.equals(channel._id))
            seen = true;

    if(!seen)
        this.channels.push({
            name:channel.name, chat_type:channel.chat_type, _id:channel._id});

    this.save();
};

UserSchema.pre('save', function(next) {
    var user = this;

    // only hash the password if it has been modified (or is new)
    if (!user.isModified('password')) return next();

    // generate a salt
    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if (err) return next(err);

        // hash the password along with our new salt
        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err);

            // override the cleartext password with the hashed one
            user.password = hash;
            next();
        });
    });
});

UserSchema.methods.comparePassword = function(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    });
};


exports.User = mongoose.model('User', UserSchema);

