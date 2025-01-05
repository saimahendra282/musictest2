const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MusicSchema = new Schema(
    {
        name: { type: String, required: true },
        picId: { type: Schema.Types.ObjectId, required: true, ref: 'uploads.files' },
        audioId: { type: Schema.Types.ObjectId, required: true, ref: 'uploads.files' },
    },
    { timestamps: true }
);


module.exports = mongoose.model('Music', MusicSchema);
