'use strict';

const assert = require('assert');
const autopopulate = require('../');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

describe('bug fixes', function() {
  let db;

  before(function() {
    db = mongoose.createConnection('mongodb://127.0.0.1:27017/autopopulate');
  });

  after(async function() {
    await db.close();
  });

  beforeEach(function() {
    const promises = [];
    for (const modelName of Object.keys(db.models)) {
      const Model = db.model(modelName);
      promises.push(Model.deleteMany({}));
    }

    return Promise.all(promises);
  });

  it('gh-15', async function() {
    const opts = {
      timestamps: { createdAt: 'createdAt' },
      collection: 'collections',
      discriminatorKey: '_type'
    };
    const rootSchema = mongoose.Schema({
      name: { type: String, required: true }
    }, opts);
    rootSchema.plugin(autopopulate);

    const Root = db.model('root', rootSchema);
    const Tag = db.model('tags', { name: String });

    const inheritSchema = new Schema({
      customTags: [{
        item: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'tags',
          autopopulate: true
        }
      }]
    }, { discriminatorKey: '_type' });
    inheritSchema.plugin(autopopulate);
    const Inherit = Root.discriminator('inherit', inheritSchema);

    const docs = await Tag.create([{ name: 'cool' }, { name: 'sweet' }]);
    let doc = {
      name: 'Test',
      customTags: [{ item: docs[0]._id }, { item: docs[1]._id }]
    };
    doc = await Inherit.create(doc);
    doc = await Inherit.findById(doc);
    assert.equal(doc.customTags[0].item.name, 'cool');
    assert.equal(doc.customTags[1].item.name, 'sweet');
  });

  it('findOneAndUpdate (gh-6641)', async function() {
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

    const axl = await Person.create({ name: 'Axl Rose' });
    let gnr = await Band.create({ name: 'GNR', lead: axl._id });

    gnr = await Band.
      findOneAndUpdate({ name: 'GNR' }, { name: 'Guns N\' Roses' });

    assert.equal(gnr.lead.name, 'Axl Rose');
  });

  it('options function with refPath (gh-45)', async function() {
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

    const offer = await Offer.create({ name: 'Labor Day Sale' });
    await Mapping.create({
      city: 'gh45_NewYork',
      offer: offer._id
    });

    await Mapping.findOne();

  });

  it('populate unpopulated paths after save() (gh-53)', async function() {
    const Person = db.model('gh53_Person', mongoose.Schema({ name: String }));
    const schema = mongoose.Schema({
      name: String,
      people: [{ type: mongoose.ObjectId, ref: 'gh53_Person', autopopulate: true }]
    });
    schema.plugin(autopopulate);
    const Group = db.model('gh53_Group', schema);

    await Person.deleteMany({});
    await Group.deleteMany({});

    const luke = await Person.create({ name: 'Luke Skywalker' });
    const obiwan = await Person.create({ name: 'Obi Wan Kenobi' });
    await Group.create({ name: 'Jedi Order', people: [luke._id] });

    const doc = await Group.findOne().populate('people');
    assert.equal(doc.people[0].name, 'Luke Skywalker');

    doc.people.push(obiwan._id);
    const res = await doc.save();

    assert.equal(res.people[0].name, 'Luke Skywalker');
    assert.equal(res.people[1].name, 'Obi Wan Kenobi');
  });

  it('skips post save populate if unnecessary (gh-53)', async function() {
    const Person = db.model('gh53_Person_2', mongoose.Schema({ name: String }));
    const schema = mongoose.Schema({
      name: String,
      people: [{ type: mongoose.ObjectId, ref: 'gh53_Person_2', autopopulate: true }]
    });
    schema.plugin(autopopulate);
    const Group = db.model('gh53_Group_2', schema);

    await Person.deleteMany({});
    await Group.deleteMany({});

    const obiwan = await Person.create({ name: 'Obi Wan Kenobi' });
    await Group.create({ name: 'Jedi Order', people: [obiwan._id] });

    const doc = await Group.findOne().populate('people');
    assert.equal(doc.people[0].name, 'Obi Wan Kenobi');

    await Person.updateOne({ name: 'Obi Wan Kenobi' }, { name: 'Ben Kenobi' });

    const res = await doc.save();

    assert.equal(res.people[0].name, 'Obi Wan Kenobi');
  });

  it('autopopulates discriminators post find (gh-26)', async function() {
    const baseSchema = new Schema({ field: String });
    baseSchema.plugin(autopopulate);

    const childSchema = new Schema({
      items: [{ type: Schema.Types.ObjectId, ref: 'gh26', autopopulate: true }]
    });
    childSchema.plugin(autopopulate);

    const Base = db.model('gh26_Test', baseSchema);
    const Child = Base.discriminator('gh26_Child', childSchema);
    const ChildData = db.model('gh26', Schema({ name: String }));

    const c = await ChildData.create({ name: 'test' });
    await Child.create({ field: 'foo', items: [c._id] });

    const doc = await Base.findOne();
    assert.ok(doc instanceof Child);
    assert.equal(doc.items[0].name, 'test');

    const docs = await Base.find();
    assert.ok(docs[0] instanceof Child);
    assert.equal(docs[0].items[0].name, 'test');
  });

  it('handles autopopulate in nested doc array when top-level array is empty (gh-70)', async function() {
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

    const player = await User.create({ name: 'test' });
    await Game.create({ players: [], state: [] });

    const doc = await Game.findOne();
    doc.players.push(player._id);
    await doc.save();

    assert.deepEqual(doc.toObject().state, []);

  });

  it('autopopulates if pushing a subdocument with an unpopulated path onto a document array (gh-77)', async function() {
    const PopulatedSchema = Schema({ name: String });
    const PopulatedModel = db.model('Test', PopulatedSchema);

    const ParentSchema = new mongoose.Schema({
      entries: [{
        name: String,
        model: {
          type: 'ObjectId',
          ref: 'Test',
          autopopulate: true
        }
      }]
    });
    ParentSchema.plugin(autopopulate);
    const ParentModel = db.model('Parent', ParentSchema);

    const populated = new PopulatedModel({ name: 'my test' });
    await populated.save();

    const doc = new ParentModel();
    doc.entries.push({ model: populated._id });
    await doc.save();

    doc.entries.push({ model: populated._id });
    await doc.save();

    assert.equal(doc.entries[0].model.name, 'my test');
    assert.equal(doc.entries[1].model.name, 'my test');

  });

  it('autopopulates embedded discriminator (gh-82)', async function() {
    const enemySchema = new Schema({
      name: String,
      level: Number
    });
    const Enemy = db.model('Enemy', enemySchema);

    const mapSchema = new Schema({
      tiles: [[new Schema({}, { discriminatorKey: 'kind', _id: false })]]
    });

    const contentPath = mapSchema.path('tiles');

    contentPath.discriminator('Enemy', new Schema({
      enemy: { type: Schema.Types.ObjectId, ref: 'Enemy', autopopulate: true }
    }));
    contentPath.discriminator('Wall', new Schema({ color: String }));
    mapSchema.plugin(autopopulate);

    const Map = db.model('Map', mapSchema);

    const e = await Enemy.create({
      name: 'Bowser',
      level: 10
    });

    let map = await Map.create({
      tiles: [[{ kind: 'Enemy', enemy: e._id }, { kind: 'Wall', color: 'Blue' }]]
    });

    map = await Map.findById(map);
    assert.equal(map.tiles[0][0].enemy.name, 'Bowser');
    assert.equal(map.tiles[0][1].color, 'Blue');

  });

  it('connection option (gh-93)', async function() {
    const userSchema = new Schema({
      name: String
    });

    const conn2 = await mongoose.createConnection('mongodb://127.0.0.1:27017/test');
    const User = conn2.model('User', userSchema);

    const responseSchema = new Schema({
      user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        autopopulate: { connection: conn2 }
      }
    });
    responseSchema.plugin(autopopulate);
    const Response = db.model('Response', responseSchema);

    const user = await User.create({ name: 'test' });
    const response = await Response.create({ user: user._id });

    const res = await Response.findById(response);
    console.log(res.user.name); // 'test'
  });

  it('handles recursive duplicates gh-101', async function() {
    const sectionSchema = new Schema({
      template: {
        type: Schema.Types.ObjectId,
        ref: 'OtherModel',
        autopopulate: false,
        required: false
      },
      text: String,
      date: Date
    });

    sectionSchema.add({
      subSections: {
        type: [sectionSchema]
      }
    });
    sectionSchema.plugin(autopopulate);
  });
});
