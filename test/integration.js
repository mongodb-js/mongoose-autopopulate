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
      lead: { type: ObjectId, ref: 'people' },
      members: [{ type: ObjectId, ref: 'people', autopopulate: true }]
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
          gnr.members = [doc._id];
          Band.create(gnr, function(error, doc) {
            assert.ifError(error);
            assert.ok(doc);
            done();
          });
        });
      });
    });
  });

  /**
   *  You can set the `autopopulate` option for the `lead` field.
   *  This means that, every time you call `find()` or `findOne()`,
   *  `mongoose-autopopulate` will automatically call `.populate('lead')`
   *  for you.
   */
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

  /**
   *  `mongoose-autopopulate` also works on arrays.
   */
  it('supports document arrays', function(done) {
    var bandSchema = new Schema({
      name: String,
      members: [{ type: ObjectId, ref: 'people', autopopulate: true }]
    });
    bandSchema.plugin(autopopulate);

    var Band = mongoose.model('band4', bandSchema, 'bands');
    Band.findOne({ name: "Guns N' Roses" }, function(error, doc) {
      assert.ifError(error);
      assert.equal('Axl Rose', doc.members[0].name);
      assert.equal('William Bruce Rose, Jr.', doc.members[0].birthName);
      done();
    });
  });

  /**
   *  Advanced users of `populate()` may want to specify additional
   *  options, such as selecting fields. If you set the `autopopulate`
   *  option to an object, `mongoose-autopopulate` will merge the object
   *  into populate options. The `findOne()` below is equivalent to
   *  `Band.findOne({ name: "Guns N' Roses" }).populate({ path: 'lead', select: 'name });`
   */
  it('can specify an options argument', function(done) {
    var bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people', autopopulate: { select: 'name' } }
    });
    bandSchema.plugin(autopopulate);

    var Band = mongoose.model('band5', bandSchema, 'bands');
    Band.findOne({ name: "Guns N' Roses" }, function(error, doc) {
      assert.ifError(error);
      assert.equal('Axl Rose', doc.lead.name);
      assert.ok(!doc.lead.birthName);
      done();
    });
  });

  /**
   *  You can also set the `autopopulate` option to be a function.
   *  Then `mongoose-autopopulate` will call the function with
   *  the query object as the context and use the return value.
   *  The below `populate()` uses the same options as the previous
   *  example.
   */
  it('can specify a function that returns options', function(done) {
    var numCalls = 0;
    var optionsFunction = function() {
      ++numCalls;
      return { select: 'name' };
    };

    var bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people', autopopulate: optionsFunction }
    });
    bandSchema.plugin(autopopulate);

    var Band = mongoose.model('band6', bandSchema, 'bands');
    Band.find({ name: "Guns N' Roses" }, function(error, docs) {
      assert.ifError(error);
      assert.equal(1, docs.length);
      assert.equal(1, numCalls);
      var doc = docs[0];
      assert.equal('Axl Rose', doc.lead.name);
      assert.ok(!doc.lead.birthName);
      done();
    });
  });
});
