"use strict";

var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var MusicSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  picId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'uploads.files'
  },
  audioId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'uploads.files'
  }
}, {
  timestamps: true
});
module.exports = mongoose.model('Music', MusicSchema);
//# sourceMappingURL=Music.dev.js.map
