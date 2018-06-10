# mongoose-autopopulate

Always `populate()` certain fields in your mongoose schemas

[![Build Status](https://travis-ci.org/mongodb-js/mongoose-autopopulate.svg?branch=master)](https://travis-ci.org/mongodb-js/mongoose-autopopulate)
[![Coverage Status](https://coveralls.io/repos/mongodb-js/mongoose-autopopulate/badge.svg?branch=master)](https://coveralls.io/r/mongodb-js/mongoose-autopopulate?branch=master)

**Note:** This plugin will *only* work with mongoose >= 4.0. Do NOT use
this plugin with mongoose 3.x. You have been warned.

**Note:** population is a powerful feature, but it has limitations and
helps you get away with poor schema design.  In particular, it is usually
bad MongoDB schema design to include arrays that grow without bound in
your documents. Do not include a constantly-growing array of ObjectIds
in your schema - your data will become unwieldy as the array grows and
you will eventually hit the [16mb document size limit](http://docs.mongodb.org/manual/reference/limits/#BSON-Document-Size).
In general, think carefully when designing your schemas.

# API

The `mongoose-autopopulate` module exposes a single function that you can
pass to the `mongoose.Schema.prototype.plugin()` function. Below you will
see how to use this function.

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


# mongoose-autopopulate plugin

## It supports an autopopulate option in schemas


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
