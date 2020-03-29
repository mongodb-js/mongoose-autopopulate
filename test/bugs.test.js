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
    db = mongoose.createConnection('mongodb://localhost:27017/autopopulate', {
      useUnifiedTopology: true,
      useNewUrlParser: true
    });
  });

  after(function(done) {
    db.close(done);
  });

  beforeEach(function() {
    const promises = [];
    for (const modelName of Object.keys(db.models)) {
      const Model = db.model(modelName);
      promises.push(Model.deleteMany({}));
    }

    return Promise.all(promises);
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

  it('populate unpopulated paths after save() (gh-53)', function() {
    const Person = db.model('gh53_Person', mongoose.Schema({ name: String }));
    const schema = mongoose.Schema({
      name: String,
      people: [{ type: mongoose.ObjectId, ref: 'gh53_Person', autopopulate: true }]
    });
    schema.plugin(autopopulate);
    const Group = db.model('gh53_Group', schema);

    return co(function*() {
      yield Person.deleteMany({});
      yield Group.deleteMany({});

      const luke = yield Person.create({ name: 'Luke Skywalker' });
      const obiwan = yield Person.create({ name: 'Obi Wan Kenobi' });
      yield Group.create({ name: 'Jedi Order', people: [luke._id] });

      const doc = yield Group.findOne().populate('people');
      assert.equal(doc.people[0].name, 'Luke Skywalker');

      doc.people.push(obiwan._id);
      const res = yield doc.save();

      assert.equal(res.people[0].name, 'Luke Skywalker');
      assert.equal(res.people[1].name, 'Obi Wan Kenobi');
    });
  });

  it('skips post save populate if unnecessary (gh-53)', function() {
    const Person = db.model('gh53_Person_2', mongoose.Schema({ name: String }));
    const schema = mongoose.Schema({
      name: String,
      people: [{ type: mongoose.ObjectId, ref: 'gh53_Person_2', autopopulate: true }]
    });
    schema.plugin(autopopulate);
    const Group = db.model('gh53_Group_2', schema);

    return co(function*() {
      yield Person.deleteMany({});
      yield Group.deleteMany({});

      const obiwan = yield Person.create({ name: 'Obi Wan Kenobi' });
      yield Group.create({ name: 'Jedi Order', people: [obiwan._id] });

      const doc = yield Group.findOne().populate('people');
      assert.equal(doc.people[0].name, 'Obi Wan Kenobi');

      yield Person.updateOne({ name: 'Obi Wan Kenobi' }, { name: 'Ben Kenobi' });

      const res = yield doc.save();

      assert.equal(res.people[0].name, 'Obi Wan Kenobi');
    });
  });

  it('autopopulates discriminators post find (gh-26)', function() {
    const baseSchema = new Schema({ field: String });
    baseSchema.plugin(autopopulate);

    const childSchema = new Schema({
      items: [{ type: Schema.Types.ObjectId, ref: 'gh26', autopopulate: true }]
    });
    childSchema.plugin(autopopulate);

    const Base = db.model('gh26_Test', baseSchema);
    const Child = Base.discriminator('gh26_Child', childSchema);
    const ChildData = db.model('gh26', Schema({ name: String }));

    return co(function*() {
      const c = yield ChildData.create({ name: 'test' });
      yield Child.create({ field: 'foo', items: [c._id] });
    
      const doc = yield Base.findOne();
      assert.ok(doc instanceof Child);
      assert.equal(doc.items[0].name, 'test');

      const docs = yield Base.find();
      assert.ok(docs[0] instanceof Child);
      assert.equal(docs[0].items[0].name, 'test');
    });
  });

  it('handles autopopulate in nested doc array when top-level array is empty (gh-70)', function() {
    const User = db.model('User', Schema({ name: String }));
    db.model('Card', Schema({ name: String }));
    const GameSchema = new Schema({
      players: [{
        type: 'ObjectId',
        ref: 'User',
        autopopulate: true
      }],
      state: [{
        cards: [{
          card: { type: 'ObjectId', ref: 'Card', autopopulate: true }
        }]
      }]
    });
    GameSchema.plugin(autopopulate);
    const Game = db.model('Game', GameSchema);

    return co(function*() {
      const player = yield User.create({ name: 'test' });
      yield Game.create({ players: [], state: [] });

      const doc = yield Game.findOne();
      doc.players.push(player._id);
      yield doc.save();

      assert.deepEqual(doc.toObject().state, []);
    });
  });
});
