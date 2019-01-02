'use strict';

const assert = require('assert');
const autopopulate = require('../');
const co = require('co');
const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

require('co-mocha')(require('mocha'));

describe('mongoose-autopopulate plugin', function() {
  var Band;
  var Person;

  before(function(done) {
    mongoose.connect('mongodb://localhost:27017/autopopulate', {
      useNewUrlParser: true
    });

    var personSchema = new Schema({ name: String, birthName: String });
    var bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people', autopopulate: true },
      members: [{ type: ObjectId, ref: 'people', autopopulate: true }]
    });
    bandSchema.plugin(autopopulate);
    Person = mongoose.model('people', personSchema, 'people');
    Band = mongoose.model('band', bandSchema, 'bands');

    var axl = {
      name: 'Axl Rose',
      birthName: 'William Bruce Rose, Jr.'
    };

    var gnr = { name: "Guns N' Roses" };

    Person.deleteMany({}, function(error) {
      assert.ifError(error);
      Band.deleteMany({}, function(error) {
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

  after(function() {
    return mongoose.disconnect();
  });

  /**
   * Suppose you have two collections, "people" and "bands". The `People` model
   * looks like this:
   *
   * ```javascript
   * var personSchema = new Schema({ name: String, birthName: String });
   * Person = mongoose.model('people', personSchema, 'people');
   * ```
   *
   * Suppose your "people" collection has one document:
   *
   * ```javascript
   * {
   *   name: 'Axl Rose',
   *   birthName: 'William Bruce Rose, Jr.',
   *   _id: '54ef3f374849dcaa649a3abc'
   * };
   * ```
   *
   * And your "bands" collection has one document:
   *
   * ```javascript
   * {
   *   _id: '54ef3f374849dcaa649a3abd',
   *   name: "Guns N' Roses",
   *   lead: '54ef3f374849dcaa649a3abc',
   *   members: ['54ef3f374849dcaa649a3abc']
   * }
   * ```
   *
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
   *  By default, Mongoose 5.x automatically projects in populated properties.
   *  That means you need a little extra work to exclude autopopulated fields.
   *  Either explicitly [deselect the path](https://mongoosejs.com/docs/api.html#query_Query-select)
   *  in your projection, or set the [`selectPopulatedPaths` schema option](https://mongoosejs.com/docs/guide.html#selectPopulatedPaths)
   *  to `false`.
   */
  it('has a couple caveats with projections', function*() {
    // Mongoose adds `members: 1` and `lead: 1` to the projection
    let band = yield Band.findOne().select({ name: 1 });
    assert.equal(band.members[0].name, 'Axl Rose');
    assert.equal(band.lead.name, 'Axl Rose');

    // You can also tell Mongoose to not project in populated paths by default
    // using the `selectPopulatedPaths` schema option.
    const newSchema = Band.schema.clone();

    newSchema.options.selectPopulatedPaths = false;
    let Band2 = mongoose.model('Band2', newSchema, 'bands');

    band = yield Band2.findOne().select({ name: 1 });
    assert.ok(!band.members);
    assert.ok(!band.lead);
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

  /**
   *  If you set the `autopopulate` option to `false` on a query, autopopulate
   *  will be disabled. This is handy if you want to autopopulate by default,
   *  but opt-out for special cases.
   */
  it('can disable autopopulate for individual queries', function(done) {
    var bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people', autopopulate: true }
    });
    bandSchema.plugin(autopopulate);

    var Band = mongoose.model('band7', bandSchema, 'bands');
    Band.findOne({ name: "Guns N' Roses" }, {}, { autopopulate: false }, function(error, doc) {
      assert.ifError(error);
      assert.ok(doc.lead instanceof mongoose.Types.ObjectId);
      assert.ok(!doc.populated('lead'));
      done();
    });
  });

  /**
   *  Say you have a model `User` that has the autopopulate plugin and you're
   *  populating users from a different model. To disable autopopulate, you
   *  need to set `autopopulate: false` as a populate option, not a query
   *  option.
   */

  it('can disable autopopulate in `populate()` options', function() {
    const userSchema = new Schema({
      name: String,
      friends: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        autopopulate: { maxDepth: 2 }
      }]
    });
    userSchema.plugin(autopopulate);

    const responseSchema = new Schema({
      user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    });

    const User = mongoose.model('User', userSchema);
    const Response = mongoose.model('Response', responseSchema);

    return co(function*() {
      const axl = new User({ name: 'Axl' });
      const slash = new User({ name: 'Slash', friends: [axl._id] });
      axl.friends.push(slash._id);

      yield [axl.save(), slash.save()];
      let r = yield Response.create({ user: axl._id });

      r = yield Response.findById(r._id).
        // Because `User` is the foreign model, you need to disable autopopulate
        // in the populate options below, not the query options
        populate({ path: 'user', options: { autopopulate: false } });
      // acquit:ignore:start
      assert.equal(r.user.name, 'Axl');
      assert.ok(r.user.friends[0] instanceof mongoose.Types.ObjectId);
      // acquit:ignore:end
    });
  });

  /**
   *  Setting the [Mongoose `lean` option](https://mongoosejs.com/docs/api.html#query_Query-lean)
   *  will disable autopopulate for all paths, _unless_ you add `autopulate: true`
   *  to your `lean` option.
   */

  it('requires an option to work with lean', function() {
    // acquit:ignore:start
    return co(function*() {
      // acquit:ignore:end
      let band = yield Band.findOne().lean();
      // Won't autopopulate because `lean()` is set
      assert.ok(band.lead instanceof mongoose.Types.ObjectId);

      // To turn on `autopopulate` with lean, use `lean({ autopulate: true })`
      band = yield Band.findOne().lean({ autopopulate: true });
      assert.equal(band.lead.name, 'Axl Rose');
      // acquit:ignore:start
    });
    // acquit:ignore:end
  });

  /**
   *  Recursive populate can lead to messy infinite recursion, so this plugin
   *  supports a `maxDepth` option that limits how deep recursive population
   *  will go. The `maxDepth` option is 10 by default
   */
  it('can limit the depth using `maxDepth`', function() {
    return co(function*() {
      const accountSchema = new mongoose.Schema({
        name: String,
        friends: [{
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Account',
          // This is a recursive relationship, `friends` points to a list
          // of accounts. If we didn't limit the depth, this would result
          // in infinite recursion!
          autopopulate: { maxDepth: 2 }
        }]
      });
      accountSchema.plugin(autopopulate);

      const Account = mongoose.model('Account', accountSchema);

      const axl = new Account({ name: 'Axl' });
      const slash = new Account({ name: 'Slash', friends: [axl._id] });
      axl.friends.push(slash._id);

      yield axl.save();
      yield slash.save();

      const doc = yield Account.findById(axl._id);

      assert.equal(doc.friends[0].name, 'Slash');
      assert.equal(doc.friends[0].friends[0].name, 'Axl');
      // Only populate 2 levels deep, 3rd level will still be an `_id`
      assert.equal(doc.friends[0].friends[0].friends[0].toString(),
        slash._id.toHexString());
    });
  });
});
