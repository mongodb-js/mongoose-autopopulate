var mongoose = require('mongoose');
var assert = require('assert');
var autopopulate = require('../');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

describe('bug fixes', function() {
  var db;

  before(function() {
    db = mongoose.createConnection('mongodb://localhost:27017/autopopulate');
  });

  after(function(done) {
    db.close(done);
  });

  it('gh-15', function(done) {
    var opts = {
      timestamps: { createdAt: 'createdAt' },
      collection : 'collections',
      discriminatorKey : '_type'
    };
    var rootSchema = mongoose.Schema({
      name: { type: String, required: true }
    }, opts);
    rootSchema.plugin(autopopulate);

    var Root = mongoose.model('root', rootSchema);
    var Tag = mongoose.model('tags', { name: String });

    var inheritSchema = new Schema({
      customTags:[{
        item: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'tags',
          autopopulate: true
        }
      }]
    }, { discriminatorKey : '_type' } );
    inheritSchema.plugin(autopopulate);
    var Inherit = Root.discriminator('inherit', inheritSchema);

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
        console.log(doc);
        assert.equal(doc.customTags[0].item.name, 'cool');
        assert.equal(doc.customTags[1].item.name, 'sweet');
        done();
      });
    }
  });
});
