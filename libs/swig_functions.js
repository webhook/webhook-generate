
// Defines a list of all the swig functions we allow in templates by default
// Is merged into the full list of functions on render
module.exports.swigFunctions = function(swig) {

  var self = this;

  this.context = {};
  this.data = {};

  this.setData = function(data) {
    self.data = data;
  };

  var getData = function(name) {
    return self.data[name];
  };

  this.getFunctions = function() {
    return {
      getData: getData,
    };
  };

  return this;
};