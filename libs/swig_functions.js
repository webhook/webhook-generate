
/**
 * Defines a set of functions usable in all swig templates, are merged into context on render
 * @param  {Object}   swig        Swig engine
 */
module.exports.swigFunctions = function(swig) {

  var self = this;

  this.context = {};
  this.data = {};

  this.setData = function(data) {
    self.data = data;
  };

  var sliceDictionary = function(dict, limit, offset) {
    var keys = [];

    limit = limit || -1;
    offset = offset || -1;

    for(var key in dict)
    {
      if(dict.hasOwnProperty(key))
      {
        keys.push(key);
      }
    }

    if(limit !== -1 && offset !== -1)
    {
      keys = keys.slice(offset, offset + limit);
    } else if (limit !== -1) {
      keys = keys.slice(0, offset + limit);
    } else if (offset !== -1) {
      keys = keys.slice(offset);
    } 

    var slicedDict = {};

    keys.forEach(function(key) {
      slicedDict[key] = dict[key];
    });

    return slicedDict;
  };

  var getData = function(name, limit, offset) {

    var data = self.data[name];

    return sliceDictionary(data, limit, offset);
  };

  this.getFunctions = function() {
    return {
      get: getData,
    };
  };

  return this;
};