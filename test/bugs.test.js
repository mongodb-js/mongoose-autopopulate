'use strict';

const assert = require('assert');
const autopopulate = require('../');
const co = require('co');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

describe('bug fixes', function() {
  let db;

  before(function() {
    db = mongoose.createConnection('mongodb://localhost:27017/autopopulate');
  });

  after(function(done) {
    db.close(done);
  });

  it('gh-15', function(done) {
    const opts = {
      timestamps: { createdAt: 'createdAt' },
      collection : 'collections',
      discriminatorKey : '_type'
    };
    const rootSchema = mongoose.Schema({
      name: { type: String, required: true }
    }, opts);
    rootSchema.plugin(autopopulate);

    const Root = mongoose.model('root', rootSchema);
    const Tag = mongoose.model('tags', { name: String });

    const inheritSchema = new Schema({
      customTags:[{
        item: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'tags',
          autopopulate: true
        }
      }]
    }, { discriminatorKey : '_type' } );
    inheritSchema.plugin(autopopulate);
    const Inherit = Root.discriminator('inherit', inheritSchema);

    Tag.create([{ name: 'cool' }, { name: 'sweet' }], function(error, docs) {
      assert.ifError(error);
      var doc = {
        name: 'Test',
        customTags: [{ item: docs[0]._id }, { item: docs[1]._id }]
      };
      Inherit.create(doc, function(error, doc) {
        assert.ifError(error);
        test(doc._id);
      });
    });

    function test(id) {
      Inherit.findById(id).exec(function(error, doc) {
        assert.ifError(error);
        assert.equal(doc.customTags[0].item.name, 'cool');
        assert.equal(doc.customTags[1].item.name, 'sweet');
        done();
      });
    }
  });
});
