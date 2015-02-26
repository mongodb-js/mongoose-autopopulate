var mongoose = require('mongoose');
var assert = require('assert');
var autopopulate = require('../');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

mongoose.connect('mongodb://localhost:27017/autopopulate');

describe('mongoose-autopopulate plugin', function() {
  it('supports an autopopulate option in schemas', function(done) {
    var schema = new Schema({
      reference: { type: ObjectId, ref: 'test', autopopulate: true }
    });
    schema.plugin(autopopulate);

    var MyModel = mongoose.model('test', schema, 'test');
    var query = MyModel.find({});
    query.exec(function(error) {
      assert.ifError(error);
      assert.ok(query._mongooseOptions.populate['reference']);
      done();
    });
  });

  it('can specify an options argument', function(done) {
    var schema = new Schema({
      name: String,
      reference: { type: ObjectId, ref: 'test2', autopopulate: { select: 'name' } }
    });
    schema.plugin(autopopulate);

    var MyModel = mongoose.model('test2', schema, 'test');
    var query = MyModel.find({});
    query.exec(function(error) {
      assert.ifError(error);
      assert.ok(query._mongooseOptions.populate['reference']);
      assert.equal('reference', query._mongooseOptions.populate['reference'].path);
      assert.equal('name', query._mongooseOptions.populate['reference'].select);
      done();
    });
  });
});
