

# mongoose-autopopulate plugin

## It supports an autopopulate option in schemas


Suppose you have two collections, "people" and "bands". The `People` model
looks like this:

```javascript
var personSchema = new Schema({ name: String, birthName: String });
Person = mongoose.model('people', personSchema, 'people');
```

Suppose your "people" collection has one document:

```javascript
{
name: 'Axl Rose',
birthName: 'William Bruce Rose, Jr.',
_id: '54ef3f374849dcaa649a3abc'
};
```

And your "bands" collection has one document:

```javascript
{
_id: '54ef3f374849dcaa649a3abd',
name: "Guns N' Roses",
lead: '54ef3f374849dcaa649a3abc',
members: ['54ef3f374849dcaa649a3abc']
}
```

You can set the `autopopulate` option for the `lead` field.
This means that, every time you call `find()` or `findOne()`,
`mongoose-autopopulate` will automatically call `.populate('lead')`
for you.


```javascript
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
```

## It supports document arrays


`mongoose-autopopulate` also works on arrays.


```javascript
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
```

## It has a couple caveats with projections


By default, Mongoose 5.x automatically projects in populated properties.
That means you need a little extra work to exclude autopopulated fields.
Either explicitly [deselect the path](https://mongoosejs.com/docs/api.html#query_Query-select)
in your projection, or set the [`selectPopulatedPaths` schema option](https://mongoosejs.com/docs/guide.html#selectPopulatedPaths)
to `false`.


```javascript
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
```

## It can specify an options argument


Advanced users of `populate()` may want to specify additional
options, such as selecting fields. If you set the `autopopulate`
option to an object, `mongoose-autopopulate` will merge the object
into populate options. The `findOne()` below is equivalent to
`Band.findOne({ name: "Guns N' Roses" }).populate({ path: 'lead', select: 'name });`


```javascript
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
```

## It can specify a function that returns options


You can also set the `autopopulate` option to be a function.
Then `mongoose-autopopulate` will call the function with
the query object as the context and use the return value.
The below `populate()` uses the same options as the previous
example.


```javascript
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
```

## It can disable autopopulate for individual queries


If you set the `autopopulate` option to `false` on a query, autopopulate
will be disabled. This is handy if you want to autopopulate by default,
but opt-out for special cases.


```javascript
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
```

## It can disable autopopulate in `populate()` options


Say you have a model `User` that has the autopopulate plugin and you're
populating users from a different model. To disable autopopulate, you
need to set `autopopulate: false` as a populate option, not a query
option.


```javascript
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
});
```

## It requires an option to work with lean


Setting the [Mongoose `lean` option](https://mongoosejs.com/docs/api.html#query_Query-lean)
will disable autopopulate for all paths, _unless_ you add `autopulate: true`
to your `lean` option.


```javascript
// acquit:ignore:start
return co(function*() {
  // acquit:ignore:end
  let band = yield Band.findOne().lean();
  // Won't autopopulate because `lean()` is set
  assert.ok(band.lead instanceof mongoose.Types.ObjectId);

  // To turn on `autopopulate` with lean, use `lean({ autopulate: true })`
  band = yield Band.findOne().lean({ autopopulate: true });
  assert.equal(band.lead.name, 'Axl Rose');
```

## It can limit the depth using `maxDepth`


Recursive populate can lead to messy infinite recursion, so this plugin
supports a `maxDepth` option that limits how deep recursive population
will go. The `maxDepth` option is 10 by default


```javascript
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
```

## It can pass a list or regular expression of functions to apply hooks to


By default, autopopulate applies to the results of `find()`, `findOne()`,
`findOneAndUpdate()`, and `save()`. You can pick which functions
you want autopopulate to handle using the `functions` option. For example,
the below code disables autopopulating on `save()`.


```javascript
return co(function*() {
  const bandSchema = new Schema({
    name: String,
    lead: { type: ObjectId, ref: 'people', autopopulate: true }
  });
  bandSchema.plugin(autopopulate, {
    // Apply this plugin to all functions except for `save()`
    functions: ['find', 'findOne', 'findOneAndUpdate']
  });
  
  const Band = mongoose.model('band8', bandSchema, 'bands');

  let band = yield Band.findOne({ name: "Guns N' Roses" });
  assert.ok(band.populated('lead'));

  band = yield Band.findOne({ name: "Guns N' Roses" }).setOptions({ autopopulate: false });
  assert.ok(!band.populated('lead'));
  // `save()` doesn't autopopulate
  yield band.save();
  assert.ok(!band.populated('lead'));
});
```
