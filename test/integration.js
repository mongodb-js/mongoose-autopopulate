'use strict';

const assert = require('assert');
const autopopulate = require('../');
const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

describe('mongoose-autopopulate plugin', function() {
  let Band;
  let Person;

  before(async function() {
    mongoose.connect('mongodb://localhost:27017/autopopulate');

    const personSchema = new Schema({ name: String, birthName: String });
    const bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people', autopopulate: true },
      members: [{ type: ObjectId, ref: 'people', autopopulate: true }]
    });
    bandSchema.plugin(autopopulate);
    Person = mongoose.model('people', personSchema, 'people');
    Band = mongoose.model('band', bandSchema, 'bands');

    const axl = {
      name: 'Axl Rose',
      birthName: 'William Bruce Rose, Jr.'
    };

    const gnr = { name: 'Guns N\' Roses' };

    await Person.deleteMany({});
    await Band.deleteMany({});
    const doc = await Person.create(axl);
    assert.ok(doc);
    gnr.lead = doc._id;
    gnr.members = [doc._id];
    await Band.create(gnr);
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
  it('supports an autopopulate option in schemas', async function() {
    const bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people', autopopulate: true }
    });
    bandSchema.plugin(autopopulate);

    const Band = mongoose.model('band3', bandSchema, 'bands');
    const doc = await Band.findOne({ name: 'Guns N\' Roses' });
    assert.equal('Axl Rose', doc.lead.name);
    assert.equal('William Bruce Rose, Jr.', doc.lead.birthName);
  });


  /**
   *  `mongoose-autopopulate` also works on arrays.
   */
  it('supports document arrays', async function() {
    const bandSchema = new Schema({
      name: String,
      members: [{ type: ObjectId, ref: 'people', autopopulate: true }]
    });
    bandSchema.plugin(autopopulate);

    const Band = mongoose.model('band4', bandSchema, 'bands');
    const doc = await Band.findOne({ name: 'Guns N\' Roses' });
    assert.equal('Axl Rose', doc.members[0].name);
    assert.equal('William Bruce Rose, Jr.', doc.members[0].birthName);
  });

  /**
   *  By default, Mongoose 5.x automatically projects in populated properties.
   *  That means you need a little extra work to exclude autopopulated fields.
   *  Either explicitly [deselect the path](https://mongoosejs.com/docs/api.html#query_Query-select)
   *  in your projection, or set the [`selectPopulatedPaths` schema option](https://mongoosejs.com/docs/guide.html#selectPopulatedPaths)
   *  to `false`.
   */
  it('has a couple caveats with projections', async function() {
    // Mongoose adds `members: 1` and `lead: 1` to the projection
    let band = await Band.findOne().select({ name: 1 });
    assert.equal(band.members[0].name, 'Axl Rose');
    assert.equal(band.lead.name, 'Axl Rose');

    // You can also tell Mongoose to not project in populated paths by default
    // using the `selectPopulatedPaths` schema option.
    const newSchema = Band.schema.clone();

    newSchema.options.selectPopulatedPaths = false;
    const Band2 = mongoose.model('Band2', newSchema, 'bands');

    band = await Band2.findOne().select({ name: 1 });
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
  it('can specify an options argument', async function() {
    const bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people', autopopulate: { select: 'name' } }
    });
    bandSchema.plugin(autopopulate);

    const Band = mongoose.model('band5', bandSchema, 'bands');
    const doc = await Band.findOne({ name: 'Guns N\' Roses' });
    assert.equal('Axl Rose', doc.lead.name);
    assert.ok(!doc.lead.birthName);
  });

  /**
   *  You can also set the `autopopulate` option to be a function.
   *  Then `mongoose-autopopulate` will call the function with
   *  the query object as the context and use the return value.
   *  The below `populate()` uses the same options as the previous
   *  example.
   */
  it('can specify a function that returns options', async() => {
    let numCalls = 0;
    const optionsFunction = function() {
      ++numCalls;
      return { select: 'name' };
    };

    const bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people', autopopulate: optionsFunction }
    });
    bandSchema.plugin(autopopulate);

    const Band = mongoose.model('band6', bandSchema, 'bands');
    const docs = await Band.find({ name: 'Guns N\' Roses' });
    assert.equal(1, docs.length);
    assert.equal(1, numCalls);
    const doc = docs[0];
    assert.equal('Axl Rose', doc.lead.name);
    assert.ok(!doc.lead.birthName);
  });

  /**
   *  If you set the `autopopulate` option to `false` on a query, autopopulate
   *  will be disabled. This is handy if you want to autopopulate by default,
   *  but opt-out for special cases.
   */
  it('can disable autopopulate for individual queries', async() => {
    const bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people', autopopulate: true }
    });
    bandSchema.plugin(autopopulate);

    const Band = mongoose.model('band7', bandSchema, 'bands');
    const doc = await Band.findOne({ name: 'Guns N\' Roses' }, {}, { autopopulate: false });
    assert.ok(doc.lead instanceof mongoose.Types.ObjectId);
    assert.ok(!doc.populated('lead'));
  });


  /**
   *  Say you have a model `User` that has the autopopulate plugin and you're
   *  populating users from a different model. To disable autopopulate, you
   *  need to set `autopopulate: false` as a populate option, not a query
   *  option.
   */

  it('can disable autopopulate in `populate()` options', async function() {
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

    const axl = new User({ name: 'Axl' });
    const slash = new User({ name: 'Slash', friends: [axl._id] });
    axl.friends.push(slash._id);

    await Promise.all([axl.save(), slash.save()]);
    let r = await Response.create({ user: axl._id });

    r = await Response.findById(r._id).
      // Because `User` is the foreign model, you need to disable autopopulate
      // in the populate options below, not the query options
      populate({ path: 'user', options: { autopopulate: false } });
    // acquit:ignore:start
    assert.equal(r.user.name, 'Axl');
    assert.ok(r.user.friends[0] instanceof mongoose.Types.ObjectId);
    // acquit:ignore:end
  });

  /**
   *  Setting the [Mongoose `lean` option](https://mongoosejs.com/docs/api.html#query_Query-lean)
   *  will disable autopopulate for all paths, _unless_ you add `autopulate: true`
   *  to your `lean` option.
   */

  it('requires an option to work with lean', async function() {
    let band = await Band.findOne().lean();
    // Won't autopopulate because `lean()` is set
    assert.ok(band.lead instanceof mongoose.Types.ObjectId);

    // To turn on `autopopulate` with lean, use `lean({ autopulate: true })`
    band = await Band.findOne().lean({ autopopulate: true });
    assert.equal(band.lead.name, 'Axl Rose');
  });

  /**
   *  Recursive populate can lead to messy infinite recursion, so this plugin
   *  supports a `maxDepth` option that limits how deep recursive population
   *  will go. The `maxDepth` option is 10 by default
   */
  it('can limit the depth using `maxDepth`', async function() {
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

    await axl.save();
    await slash.save();

    const doc = await Account.findById(axl._id);

    assert.equal(doc.friends[0].name, 'Slash');
    assert.equal(doc.friends[0].friends[0].name, 'Axl');
    // Only populate 2 levels deep, 3rd level will still be an `_id`
    assert.equal(doc.friends[0].friends[0].friends[0].toString(),
      slash._id.toHexString());
  });

  /**
   *  By default, autopopulate applies to the results of `find()`, `findOne()`,
   *  `findOneAndUpdate()`, and `save()`. You can pick which functions
   *  you want autopopulate to handle using the `functions` option. For example,
   *  the below code disables autopopulating on `save()`.
   */
  it('can pass a list or regular expression of functions to apply hooks to', async function() {
    const bandSchema = new Schema({
      name: String,
      lead: { type: ObjectId, ref: 'people', autopopulate: true }
    });
    bandSchema.plugin(autopopulate, {
      // Apply this plugin to all functions except for `save()`
      functions: ['find', 'findOne', 'findOneAndUpdate']
    });

    const Band = mongoose.model('band8', bandSchema, 'bands');

    let band = await Band.findOne({ name: 'Guns N\' Roses' });
    assert.ok(band.populated('lead'));

    band = await Band.findOne({ name: 'Guns N\' Roses' }).setOptions({ autopopulate: false });
    assert.ok(!band.populated('lead'));
    // `save()` doesn't autopopulate
    await band.save();
    assert.ok(!band.populated('lead'));
  });
});
