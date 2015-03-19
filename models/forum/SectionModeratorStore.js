
'use strict';


var Mongoose = require('mongoose');
var Schema = Mongoose.Schema;

module.exports = function (N, collectionName) {

  var SectionModeratorStore = new Schema({
      section_id : Schema.Types.ObjectId,

      //  data:
      //    user1_id:
      //      setting1_key:
      //        value: Mixed
      //        own: Boolean
      //
      data       : { type: Schema.Types.Mixed, 'default': {} }
    },
    {
      versionKey: false
    });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // Needed in the store
  SectionModeratorStore.index({ section_id: 1 });

  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_SectionModeratorStore(__, callback) {
    N.wire.emit('init:models.' + collectionName, SectionModeratorStore, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_SectionModeratorStore(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });


  N.wire.before('init:models.forum.Section', function moderator_store_update_after_section_update(schema) {
    // When a section is created, add a store document for it
    //
    schema.pre('save', function (callback) {
      if (!this.isNew) {
        callback();
        return;
      }

      var store = new N.models.forum.SectionModeratorStore({ section_id: this._id });
      store.save(callback);
    });

    // When a section is removed, delete a relevant store document
    //
    schema.post('remove', function (section) {
      N.models.forum.SectionModeratorStore.remove({ section_id: section._id }, function (err) {
        if (err) {
          N.logger.error('After %s section is removed, cannot remove related settings: %s', section._id, err);
        }
      });
    });
  });
};