var mongoose = require('mongoose');
var assert = require('assert');
var autopopulate = require('../');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

mongoose.connect('mongodb://localhost:27017/autopopulate');

describe('mongoose-autopopulate plugin', function() {
  var Band;
  var Person;

  before(function(done) {
    var personSchema = new Schema({ name: String, birthName: String });
    var bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people' }
    });
    Person = mongoose.model('people', personSchema, 'people');
    Band = mongoose.model('band', bandSchema, 'bands');

    var axl = {
      name: 'Axl Rose',
      birthName: 'William Bruce Rose, Jr.'
    };

    var gnr = { name: "Guns N' Roses" };

    Person.remove({}, function(error) {
      assert.ifError(error);
      Band.remove({}, function(error) {
        assert.ifError(error);
        Person.create(axl, function(error, doc) {
          assert.ifError(error);
          assert.ok(doc);
          gnr.lead = doc._id;
          Band.create(gnr, function(error, doc) {
            assert.ifError(error);
            assert.ok(doc);
            done();
          });
        });
      });
    });
  });

  it('supports an autopopulate option in schemas', function(done) {
    var bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people', autopopulate: true }
    });
    bandSchema.plugin(autopopulate);

    var Band = mongoose.model('band3', bandSchema, 'bands');
    Band.findOne({ name: "Guns N' Roses" }, function(error, doc) {
      assert.ifError(error);
      assert.equal('Axl Rose', doc.lead.name);
      assert.equal('William Bruce Rose, Jr.', doc.lead.birthName);
      done();
    });
  });

  it('can specify an options argument', function(done) {
    var bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people', autopopulate: { select: 'name' } }
    });
    bandSchema.plugin(autopopulate);

    var Band = mongoose.model('band2', bandSchema, 'bands');
    Band.findOne({ name: "Guns N' Roses" }, function(error, doc) {
      assert.ifError(error);
      assert.equal('Axl Rose', doc.lead.name);
      assert.ok(!doc.lead.birthName);
      done();
    });
  });

  it('can specify a function that returns options', function(done) {
    var optionsFunction = function() {
      return { select: 'name' };
    };

    var bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people', autopopulate: optionsFunction }
    });
    bandSchema.plugin(autopopulate);

    var Band = mongoose.model('band4', bandSchema, 'bands');
    Band.find({ name: "Guns N' Roses" }, function(error, docs) {
      assert.ifError(error);
      assert.equal(1, docs.length);
      var doc = docs[0];
      assert.equal('Axl Rose', doc.lead.name);
      assert.ok(!doc.lead.birthName);
      done();
    });
  });
});
