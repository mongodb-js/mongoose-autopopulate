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

    const Root = db.model('root', rootSchema);
    const Tag = db.model('tags', { name: String });

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

  it('findOneAndUpdate (gh-6641)', function() {
    const personSchema = new Schema({ name: String });
    const bandSchema = new Schema({
      name: String,
      lead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'gh6641_Person',
        autopopulate: true
      }
    });
    bandSchema.plugin(autopopulate);

    const Person = db.model('gh6641_Person', personSchema);
    const Band = db.model('gh6641_Band', bandSchema);

    return co(function*() {
      const axl = yield Person.create({ name: 'Axl Rose' });
      let gnr = yield Band.create({ name: 'GNR', lead: axl._id });

      gnr = yield Band.
        findOneAndUpdate({ name: 'GNR' }, { name: 'Guns N\' Roses' });

      assert.equal(gnr.lead.name, 'Axl Rose');
    });
  });

  it('options function with refPath (gh-45)', function() {
    const offerSchema = new Schema({ name: String });
    const mappingSchema = new Schema({
      city: String,
      offer: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'city',
        autopopulate: function(opts) {
          assert.equal(opts.refPath, 'city');
          return opts;
        }
      }
    });
    mappingSchema.plugin(autopopulate);

    const Offer = db.model('gh45_NewYork', offerSchema);
    const Mapping = db.model('gh45_Mapping', mappingSchema);

    return co(function*() {
      const offer = yield Offer.create({ name: 'Labor Day Sale' });
      const mapping = yield Mapping.create({
        city: 'gh45_NewYork',
        offer: offer._id
      });

      yield Mapping.findOne();
    });
  });
});
