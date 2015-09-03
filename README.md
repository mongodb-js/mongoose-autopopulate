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
#### It supports an autopopulate option in schemas


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

#### It supports document arrays


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

#### It can specify an options argument


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

#### It can specify a function that returns options


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

